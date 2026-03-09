"""Provider create logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. compute_can_create — permission check
  3. resolve_provider_values — raw value → ID resolution
  4. create_provider_artifact — junction writes
  5. create_denormalized_snapshot — providers_resource snapshot
"""

from __future__ import annotations

from uuid import UUID

import asyncpg
from fastapi import HTTPException
from pydantic import BaseModel
from redis.asyncio import Redis

from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.provider_permissions_context import (
    create_denormalized_snapshot,
    resolve_provider_values,
)
from app.routes.v5.tools.artifacts.provider.create import (
    create_provider as create_provider_artifact,
)
from app.utils.cache.invalidate_tags import invalidate_tags


class CreateProviderItem(BaseModel):
    """Single provider item for create — no provider_id."""

    id: UUID | None = None

    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    # ID-only fields
    endpoint_ids: list[UUID] | None = None
    key_ids: list[UUID] | None = None
    value_ids: list[UUID] | None = None


async def create_provider_client(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list,
    group_id: UUID | None = None,
) -> dict:
    """Provider bulk create using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role, department_ids
      2. compute_can_create — single check (applies to all items)
      3. Per-item value resolution (raw → ID, required field enforcement)
      4. Single transaction: create_provider_artifact + denormalized snapshot per item
      5. invalidate_tags
    """
    from app.infra.provider_permissions import compute_can_create
    from app.routes.v5.api.main.provider.types import (
        CreateProviderApiResponse,
        ProviderResultItem,
    )

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(pool, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Permission check ───────────────────────────────────────

    if not compute_can_create(user_role=profile.role, department_ids=None):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to create providers.",
        )

    # ── Step 3: Per-item value resolution ──────────────────────────────

    has_errors = False
    error_results: list[ProviderResultItem] = []

    async with pool.acquire() as conn:
        for idx, item in enumerate(items):
            item_errors = await resolve_provider_values(
                conn, redis, item, is_create=True
            )
            if item_errors:
                has_errors = True
                error_results.append(
                    ProviderResultItem(
                        success=False,
                        message=f"Item {idx}: Validation errors",
                        errors=item_errors,
                    )
                )
            else:
                error_results.append(
                    ProviderResultItem(success=True, message="Validated")
                )

    if has_errors:
        return CreateProviderApiResponse(results=error_results)

    # ── Step 4: Single transaction ─────────────────────────────────────

    results: list[ProviderResultItem] = []

    async with pool.acquire() as conn:
        async with conn.transaction():
            for item in items:
                # Create denormalized snapshot
                providers_resource_id = await create_denormalized_snapshot(
                    conn,
                    redis,
                    id=item.id,
                    name_id=item.name_id,
                    description_id=item.description_id,
                )

                result = await create_provider_artifact(
                    conn,
                    id=item.id,
                    name_id=item.name_id,
                    description_id=item.description_id,
                    department_ids=item.department_ids,
                    endpoint_ids=item.endpoint_ids,
                    flag_ids=[item.active_flag_id] if item.active_flag_id else None,
                    key_ids=item.key_ids,
                    provider_ids=[providers_resource_id],
                    value_ids=item.value_ids,
                )

                results.append(
                    ProviderResultItem(
                        success=True,
                        provider_id=result.id,
                        message="Provider created successfully",
                    )
                )

    # ── Step 5: Invalidate cache ───────────────────────────────────────

    await invalidate_tags(["providers"], redis=redis)

    return CreateProviderApiResponse(results=results)
