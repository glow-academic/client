"""Auth create logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. compute_can_create — permission check
  3. resolve_auth_values — raw value → ID resolution
  4. create_auth_artifact — junction writes
  5. create_denormalized_snapshot — auths_resource snapshot
  6. perform_keycloak_sync — sync auth state (non-fatal)
"""

from __future__ import annotations

from uuid import UUID

import asyncpg
from fastapi import HTTPException
from pydantic import BaseModel
from redis.asyncio import Redis

from app.infra.auth.keycloak_sync import perform_keycloak_sync
from app.infra.auth_permissions_context import (
    create_denormalized_snapshot,
    resolve_auth_values,
)
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.tools.artifacts.auth.create import (
    create_auth as create_auth_artifact,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


class CreateAuthItem(BaseModel):
    """Single auth item for create — no auth_id.

    Required fields (name): provide ID or value.
    """

    id: UUID | None = None

    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    slug_id: UUID | None = None
    # Optional flag
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    protocol_ids: list[UUID] | None = None
    item_ids: list[UUID] | None = None
    auth_resource_ids: list[UUID] | None = None


class AuthFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class AuthResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    auth_id: UUID | None = None
    message: str
    errors: list[AuthFieldError] | None = None


class CreateAuthApiResponse(BaseModel):
    """Response model for bulk create auth endpoint."""

    results: list[AuthResultItem]


async def create_auth_client(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list,
    session_id: UUID | None = None,
    draft_id: UUID | None = None,
    group_id: UUID | None = None,
) -> dict:
    """Auth bulk create using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role, department_ids
      2. compute_can_create — single check (applies to all items)
      3. Per-item value resolution (raw → ID, required field enforcement)
      4. Single transaction: create_auth_artifact + denormalized snapshot per item
      5. invalidate_tags
      6. perform_keycloak_sync (non-fatal)
    """
    from app.infra.auth_permissions import compute_can_create

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(
        pool,
        profile_id,
        redis,
        session_id=session_id,
        draft_id=draft_id,
    )

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Permission check ───────────────────────────────────────

    if not compute_can_create(user_role=profile.role):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to create auths.",
        )

    # ── Step 3: Per-item value resolution ──────────────────────────────

    has_errors = False
    error_results: list[AuthResultItem] = []

    for idx, item in enumerate(items):
        async with pool.acquire() as conn:
            item_errors = await resolve_auth_values(conn, redis, item, is_create=True)
        if item_errors:
            has_errors = True
            error_results.append(
                AuthResultItem(
                    success=False,
                    message=f"Item {idx}: Validation errors",
                    errors=item_errors,
                )
            )
        else:
            error_results.append(AuthResultItem(success=True, message="Validated"))

    if has_errors:
        return CreateAuthApiResponse(results=error_results)

    # ── Step 4: Single transaction ─────────────────────────────────────

    results: list[AuthResultItem] = []

    async with pool.acquire() as conn:
        async with conn.transaction():
            for item in items:
                # Create denormalized snapshot
                auths_resource_id = await create_denormalized_snapshot(
                    conn,
                    redis,
                    id=item.id,
                    name_id=item.name_id,
                    description_id=item.description_id,
                    department_ids=item.department_ids,
                )

                result = await create_auth_artifact(
                    conn,
                    id=item.id,
                    name_id=item.name_id,
                    description_id=item.description_id,
                    slug_id=item.slug_id,
                    department_ids=item.department_ids,
                    flag_ids=[item.active_flag_id] if item.active_flag_id else None,
                    item_ids=item.item_ids,
                    protocol_ids=item.protocol_ids,
                    auth_ids=[auths_resource_id]
                    if auths_resource_id
                    else item.auth_resource_ids,
                )

                results.append(
                    AuthResultItem(
                        success=True,
                        auth_id=result.id,
                        message="Auth created successfully",
                    )
                )

    # ── Step 5: Invalidate cache ───────────────────────────────────────

    await invalidate_tags(["auths"], redis=redis)

    # ── Step 6: Keycloak sync (non-fatal) ──────────────────────────────

    try:
        await perform_keycloak_sync(department_id=None)
    except Exception:
        logger.warning("Keycloak sync failed after auth create (non-fatal)")

    return CreateAuthApiResponse(results=results)
