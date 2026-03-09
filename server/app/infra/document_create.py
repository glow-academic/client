"""Document create logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. compute_can_create — permission check
  3. resolve_document_values — raw value → ID resolution
  4. create_document_artifact — junction writes
  5. create_denormalized_snapshot — documents_resource snapshot
"""

from __future__ import annotations

from uuid import UUID

import asyncpg
from fastapi import HTTPException
from pydantic import BaseModel
from redis.asyncio import Redis

from app.infra.document_permissions_context import (
    create_denormalized_snapshot,
    resolve_document_values,
)
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.tools.artifacts.document.create import (
    create_document as create_document_artifact,
)
from app.utils.cache.invalidate_tags import invalidate_tags


class CreateDocumentItem(BaseModel):
    """Single document item for create — no document_id.

    Required fields (name): provide ID or value.
    """

    id: UUID | None = None

    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    # Flag — provide ID or boolean
    flag_id: UUID | None = None
    is_inactive: bool | None = None
    # Multi-select — provide IDs or names
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    # Multi-select — IDs only
    field_ids: list[UUID] | None = None
    upload_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    text_ids: list[UUID] | None = None


async def create_document_client(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list,
    group_id: UUID | None = None,
) -> dict:
    """Document bulk create using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role, department_ids
      2. compute_can_create — single check (applies to all items)
      3. Per-item value resolution (raw → ID, required field enforcement)
      4. Single transaction: create_document_artifact + denormalized snapshot per item
      5. invalidate_tags
    """
    from app.infra.document_permissions import compute_can_create
    from app.routes.v5.api.main.document.types import (
        CreateDocumentApiResponse,
        DocumentResultItem,
    )

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(pool, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Permission check ───────────────────────────────────────

    if not compute_can_create(profile.role, None):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to create documents.",
        )

    # ── Step 3: Per-item value resolution ──────────────────────────────

    has_errors = False
    error_results: list[DocumentResultItem] = []

    async with pool.acquire() as conn:
        for idx, item in enumerate(items):
            item_errors = await resolve_document_values(conn, redis, item, is_create=True)
            if item_errors:
                has_errors = True
                error_results.append(
                    DocumentResultItem(
                        success=False,
                        message=f"Item {idx}: Validation errors",
                        errors=item_errors,
                    )
                )
            else:
                error_results.append(
                    DocumentResultItem(success=True, message="Validated")
                )

    if has_errors:
        return CreateDocumentApiResponse(results=error_results)

    # ── Step 4: Single transaction ─────────────────────────────────────

    results: list[DocumentResultItem] = []

    async with pool.acquire() as conn:
        async with conn.transaction():
            for item in items:
                # Create denormalized snapshot
                documents_resource_id = await create_denormalized_snapshot(
                    conn,
                    redis,
                    id=item.id,
                    name_id=item.name_id,
                    description_id=item.description_id,
                )

                flag_ids = [item.flag_id] if item.flag_id else None

                result = await create_document_artifact(
                    conn,
                    id=item.id,
                    name_id=item.name_id,
                    description_id=item.description_id,
                    department_ids=item.department_ids,
                    flag_ids=flag_ids,
                    file_ids=item.upload_ids,
                    image_ids=item.image_ids,
                    parameter_field_ids=item.field_ids,
                    text_ids=item.text_ids,
                    document_ids=[documents_resource_id],
                )

                results.append(
                    DocumentResultItem(
                        success=True,
                        document_id=result.id,
                        message="Document created successfully",
                    )
                )

    # ── Step 5: Invalidate cache ───────────────────────────────────────

    await invalidate_tags(["documents"], redis=redis)

    return CreateDocumentApiResponse(results=results)
