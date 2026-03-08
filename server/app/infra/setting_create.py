"""Setting create logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. Permission check — role-based
  3. resolve_setting_values — raw value → ID resolution
  4. create_setting_artifact — junction writes
  5. create_denormalized_snapshot — settings_resource snapshot
"""

from __future__ import annotations

from uuid import UUID
from pydantic import BaseModel

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.setting_permissions_context import (
    create_denormalized_snapshot,
    resolve_setting_values,
)
from app.routes.v5.tools.artifacts.setting.create import (
    create_setting as create_setting_artifact,
)
from app.utils.cache.invalidate_tags import invalidate_tags


class CreateSettingItem(BaseModel):
    """Single setting item for create — no setting_id.

    Required fields (name): provide ID or value.
    """

    id: UUID | None = None

    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    # Optional flag
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # Optional multi-select — provide IDs or values
    department_ids: list[UUID] | None = None
    departments: list[str] | None = None
    color_ids: list[UUID] | None = None
    profile_ids: list[UUID] | None = None
    auth_ids: list[UUID] | None = None
    provider_key_ids: list[UUID] | None = None
    auth_item_key_ids: list[UUID] | None = None
    auth_item_value_ids: list[UUID] | None = None
    system_ids: list[UUID] | None = None
    threshold_ids: list[UUID] | None = None
    setting_resource_ids: list[UUID] | None = None


async def create_setting_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list,
    group_id: UUID | None = None,
) -> dict:
    """Setting bulk create using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role, department_ids
      2. Permission check — role-based (admin/superadmin)
      3. Per-item value resolution (raw → ID, required field enforcement)
      4. Single transaction: create_setting_artifact + denormalized snapshot per item
      5. invalidate_tags
    """
    from app.routes.v5.api.main.setting.types import (
        CreateSettingApiResponse,
        SettingResultItem,
    )

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Permission check ───────────────────────────────────────

    if profile.role not in ("admin", "superadmin"):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to create settings.",
        )

    # ── Step 3: Per-item value resolution ──────────────────────────────

    has_errors = False
    error_results: list[SettingResultItem] = []

    for idx, item in enumerate(items):
        item_errors = await resolve_setting_values(conn, redis, item, is_create=True)
        if item_errors:
            has_errors = True
            error_results.append(
                SettingResultItem(
                    success=False,
                    message=f"Item {idx}: Validation errors",
                    errors=item_errors,
                )
            )
        else:
            error_results.append(SettingResultItem(success=True, message="Validated"))

    if has_errors:
        return CreateSettingApiResponse(results=error_results)

    # ── Step 4: Single transaction ─────────────────────────────────────

    results: list[SettingResultItem] = []

    async with conn.transaction():
        for item in items:
            # Create denormalized snapshot
            settings_resource_id = await create_denormalized_snapshot(
                conn,
                redis,
                id=item.id,
                name_id=item.name_id,
                description_id=item.description_id,
            )

            result = await create_setting_artifact(
                conn,
                id=item.id,
                name_id=item.name_id,
                description_id=item.description_id,
                department_ids=item.department_ids,
                flag_ids=[item.active_flag_id] if item.active_flag_id else None,
                color_ids=item.color_ids,
                profile_ids=item.profile_ids,
                auth_ids=item.auth_ids,
                provider_key_ids=item.provider_key_ids,
                auth_item_key_ids=item.auth_item_key_ids,
                auth_item_value_ids=item.auth_item_value_ids,
                system_ids=item.system_ids,
                threshold_ids=item.threshold_ids,
                setting_ids=[settings_resource_id]
                if settings_resource_id
                else item.setting_resource_ids,
            )

            results.append(
                SettingResultItem(
                    success=True,
                    setting_id=result.id,
                    message="Setting created successfully",
                )
            )

    # ── Step 5: Invalidate cache ───────────────────────────────────────

    await invalidate_tags(["settings"], redis=redis)

    return CreateSettingApiResponse(results=results)
