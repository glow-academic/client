"""Department save logic — composable infra architecture.

Core save function that composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. resolve_department_permissions_context — access check
  3. Resource create/search tools — raw value -> ID resolution
  4. Artifact create/update tools — junction writes
  5. Department resource create tool — denormalized snapshot
  6. perform_keycloak_sync — sync department to Keycloak (non-fatal)
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING
from uuid import UUID

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.department_permissions_context import (
    resolve_department_permissions_context,
)
from app.infra.profile_identity_context import resolve_profile_identity_context

# Artifact tools
from app.routes.v5.tools.artifacts.department.create import (
    create_department as create_department_artifact,
)
from app.routes.v5.tools.artifacts.department.update import (
    _UNSET,
)
from app.routes.v5.tools.artifacts.department.update import (
    update_department as update_department_artifact,
)

# Resource create tool (denormalized snapshot)
from app.routes.v5.tools.resources.departments.create import (
    create_department as create_department_resource,
)

# Resource create tools (raw value -> ID)
from app.routes.v5.tools.resources.descriptions.create import create_description
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.flags.search import search_flags
from app.routes.v5.tools.resources.names.create import create_name
from app.routes.v5.tools.resources.names.get import get_names
from app.utils.cache.invalidate_tags import invalidate_tags

if TYPE_CHECKING:
    from app.routes.v5.api.main.department.types import (
        SaveDepartmentApiResponse,
        SaveDepartmentFieldError,
        SaveDepartmentItem,
        SaveDepartmentResult,
    )


# ---------------------------------------------------------------------------
# Value resolution — raw value -> ID via create/search tools
# ---------------------------------------------------------------------------


async def resolve_department_values(
    pool: asyncpg.Pool,
    redis: Redis,
    item: SaveDepartmentItem,
    is_update: bool,
) -> list[SaveDepartmentFieldError]:
    """Resolve raw value fields to resource IDs (mutates item in place).

    For 'create' resources (name, description):
      Creates a new resource via the create tool.

    Returns a list of errors (empty if all resolved).
    """
    from app.routes.v5.api.main.department.types import SaveDepartmentFieldError

    errors: list[SaveDepartmentFieldError] = []

    # --- Create resources ---

    async with pool.acquire() as conn:
        if item.name is not None and item.name_id is None:
            result = await create_name(conn, item.name, redis)
            item.name_id = result.id

        if item.description is not None and item.description_id is None:
            result = await create_description(conn, item.description, redis)
            item.description_id = result.id

    # --- Match resources ---

    if item.active_flag is not None and item.active_flag_id is None:
        async with pool.acquire() as conn:
            results = await search_flags(
                conn,
                redis,
                search=None,
                flag_type="department_active",
                limit_count=100,
                department=True,
            )
        match = next((r for r in results if r.type == "department_active"), None)
        if match and match.id:
            if item.active_flag:
                item.active_flag_id = match.id
        elif item.active_flag:
            errors.append(
                SaveDepartmentFieldError(
                    field="active_flag", message="Active flag resource not found"
                )
            )

    # --- Validate required fields (create only) ---

    if not is_update:
        if item.name_id is None:
            errors.append(
                SaveDepartmentFieldError(field="name", message="Name is required")
            )

    return errors


# ---------------------------------------------------------------------------
# Denormalized snapshot — hydrate resource IDs to values
# ---------------------------------------------------------------------------


async def _create_denormalized_snapshot(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    name_id: UUID | None,
    description_id: UUID | None,
) -> UUID:
    """Create a departments_resource snapshot by hydrating IDs to values.

    NOTE: This is called within an existing transaction, so it receives conn directly.
    """

    async def _empty() -> list:
        return []

    names, descriptions = await asyncio.gather(
        get_names(conn, [name_id], redis, bypass_cache=True) if name_id else _empty(),
        get_descriptions(conn, [description_id], redis, bypass_cache=True)
        if description_id
        else _empty(),
    )

    result = await create_department_resource(
        conn,
        name=names[0].name if names else "",
        description=descriptions[0].description if descriptions else "",
        redis=redis,
    )
    return result.id


# ---------------------------------------------------------------------------
# save_department_client — composable infra architecture
# ---------------------------------------------------------------------------


async def save_department_client(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list[SaveDepartmentItem],
    group_id: UUID | None = None,
) -> SaveDepartmentApiResponse:
    """Department save using composable infra functions.

    Flow:
      1. resolve_profile_identity_context -> role, department_ids
      2. Per-item permission check (fail fast)
      3. Per-item value resolution (raw -> ID)
      4. Single transaction: artifact create/update + denormalized snapshot
      5. invalidate_tags
      6. perform_keycloak_sync (non-fatal)
    """
    from app.infra.department_permissions import (
        compute_can_create,
        compute_can_edit,
    )
    from app.routes.v5.api.main.department.types import (
        SaveDepartmentApiResponse,
        SaveDepartmentResult,
    )

    # -- Step 1: Profile context --

    profile = await resolve_profile_identity_context(pool, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # -- Step 2: Per-item permission check --

    for idx, item in enumerate(items):
        if item.input_department_id is not None:
            async with pool.acquire() as conn:
                perms = await resolve_department_permissions_context(
                    conn, item.input_department_id
                )
            if not perms.exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Item {idx}: Department {item.input_department_id} not found.",
                )
            if not compute_can_edit(
                user_role=profile.role,
                usage_count=perms.usage_count,
            ):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to save this department.",
                )
        else:
            if not compute_can_create(user_role=profile.role):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to create a department.",
                )

    # -- Step 3: Per-item value resolution --

    has_errors = False
    error_results: list[SaveDepartmentResult] = []

    for idx, item in enumerate(items):
        item_errors = await resolve_department_values(
            pool,
            redis,
            item,
            is_update=item.input_department_id is not None,
        )
        if item_errors:
            has_errors = True
            error_results.append(
                SaveDepartmentResult(
                    success=False,
                    message=f"Item {idx}: Validation errors",
                    errors=item_errors,
                )
            )
        else:
            error_results.append(
                SaveDepartmentResult(success=True, message="Validated")
            )

    if has_errors:
        return SaveDepartmentApiResponse(results=error_results)

    # -- Step 4: Single transaction --

    results: list[SaveDepartmentResult] = []
    saved_department_ids: list[UUID] = []

    async with pool.acquire() as conn:
        async with conn.transaction():
            for _idx, item in enumerate(items):
                is_update = item.input_department_id is not None

                # Create denormalized snapshot
                departments_resource_id = await _create_denormalized_snapshot(
                    conn,
                    redis,
                    name_id=item.name_id,
                    description_id=item.description_id,
                )

                if is_update:
                    result = await update_department_artifact(
                        conn,
                        item.input_department_id,
                        name_id=item.name_id if item.name_id else _UNSET,
                        description_id=item.description_id
                        if item.description_id
                        else _UNSET,
                        department_ids=[departments_resource_id],
                        flag_ids=[item.active_flag_id]
                        if item.active_flag_id
                        else None,
                        settings_ids=item.settings_ids,
                    )
                    department_id = result.id
                else:
                    result = await create_department_artifact(
                        conn,
                        name_id=item.name_id,
                        description_id=item.description_id,
                        department_ids=[departments_resource_id],
                        flag_ids=[item.active_flag_id]
                        if item.active_flag_id
                        else None,
                        settings_ids=item.settings_ids,
                    )
                    department_id = result.id

                saved_department_ids.append(department_id)
                results.append(
                    SaveDepartmentResult(
                        success=True,
                        department_id=department_id,
                        message="Department updated successfully"
                        if is_update
                        else "Department created successfully",
                    )
                )

    # -- Step 5: Invalidate cache --

    await invalidate_tags(["departments"], redis=redis)

    # -- Step 6: Keycloak sync (non-fatal) --

    from app.infra.auth.keycloak_sync import perform_keycloak_sync

    for department_id in saved_department_ids:
        try:
            await perform_keycloak_sync(department_id=str(department_id))
        except Exception:
            pass  # Non-fatal — sync failures should not block save

    return SaveDepartmentApiResponse(results=results)
