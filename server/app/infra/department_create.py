"""Department create logic — composable infra architecture.

Composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. compute_can_create — permission check
  3. resolve_department_values — raw value → ID resolution
  4. create_department_artifact — junction writes
  5. create_denormalized_snapshot — departments_resource snapshot
  6. perform_keycloak_sync — sync department to Keycloak (non-fatal)
"""

from __future__ import annotations

from uuid import UUID
from pydantic import BaseModel

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.department_permissions_context import (
    create_denormalized_snapshot,
    resolve_department_values,
)
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.routes.v5.tools.artifacts.department.create import (
    create_department as create_department_artifact,
)
from app.utils.cache.invalidate_tags import invalidate_tags


class CreateDepartmentItem(BaseModel):
    """Single department item for create — no department_id.

    Required fields (name): provide ID or value.
    """

    id: UUID | None = None

    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    active_flag_id: UUID | None = None
    active_flag: bool | None = None
    # ID-only fields
    settings_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None


async def create_department_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list,
    group_id: UUID | None = None,
) -> dict:
    """Department bulk create using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role, department_ids
      2. compute_can_create — single check (applies to all items)
      3. Per-item value resolution (raw → ID, required field enforcement)
      4. Single transaction: create_department_artifact + denormalized snapshot per item
      5. invalidate_tags
      6. perform_keycloak_sync (non-fatal)
    """
    from app.infra.department_permissions import compute_can_create
    from app.routes.v5.api.main.department.types import (
        CreateDepartmentApiResponse,
        DepartmentResultItem,
    )

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Permission check ───────────────────────────────────────

    if not compute_can_create(user_role=profile.role):
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to create departments.",
        )

    # ── Step 3: Per-item value resolution ──────────────────────────────

    has_errors = False
    error_results: list[DepartmentResultItem] = []

    for idx, item in enumerate(items):
        item_errors = await resolve_department_values(conn, redis, item, is_create=True)
        if item_errors:
            has_errors = True
            error_results.append(
                DepartmentResultItem(
                    success=False,
                    message=f"Item {idx}: Validation errors",
                    errors=item_errors,
                )
            )
        else:
            error_results.append(
                DepartmentResultItem(success=True, message="Validated")
            )

    if has_errors:
        return CreateDepartmentApiResponse(results=error_results)

    # ── Step 4: Single transaction ─────────────────────────────────────

    results: list[DepartmentResultItem] = []
    saved_department_ids: list[UUID] = []

    async with conn.transaction():
        for item in items:
            # Create denormalized snapshot
            departments_resource_id = await create_denormalized_snapshot(
                conn,
                redis,
                id=item.id,
                name_id=item.name_id,
                description_id=item.description_id,
            )

            result = await create_department_artifact(
                conn,
                id=item.id,
                name_id=item.name_id,
                description_id=item.description_id,
                department_ids=[departments_resource_id],
                flag_ids=[item.active_flag_id] if item.active_flag_id else None,
                settings_ids=item.settings_ids,
            )

            saved_department_ids.append(result.id)
            results.append(
                DepartmentResultItem(
                    success=True,
                    department_id=result.id,
                    message="Department created successfully",
                )
            )

    # ── Step 5: Invalidate cache ───────────────────────────────────────

    await invalidate_tags(["departments"], redis=redis)

    # ── Step 6: Keycloak sync (non-fatal) ──────────────────────────────

    from app.infra.auth.keycloak_sync import perform_keycloak_sync

    for department_id in saved_department_ids:
        try:
            await perform_keycloak_sync(department_id=str(department_id))
        except Exception:
            pass  # Non-fatal — sync failures should not block create

    return CreateDepartmentApiResponse(results=results)
