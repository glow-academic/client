"""Profile save logic — composable infra architecture.

Core save function that composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. resolve_profile_permissions_context — access check
  3. Resource create/search tools — raw value -> ID resolution
  4. Artifact create/update tools — junction writes
  5. Profile resource create tool — denormalized snapshot
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.profile_permissions_context import resolve_profile_permissions_context

# Artifact tools
from app.routes.v5.tools.artifacts.profile.create import (
    create_profile as create_profile_artifact,
)
from app.routes.v5.tools.artifacts.profile.update import (
    _UNSET,
)
from app.routes.v5.tools.artifacts.profile.update import (
    update_profile as update_profile_artifact,
)

# Resource search tools (match by name -> ID)
from app.routes.v5.tools.resources.departments.search import search_departments

# Resource create tools (raw value -> ID)
from app.routes.v5.tools.resources.names.create import create_name
from app.routes.v5.tools.resources.names.get import get_names

# Resource create tool (denormalized snapshot)
from app.routes.v5.tools.resources.profiles.create import (
    create_profile as create_profile_resource,
)
from app.utils.cache.invalidate_tags import invalidate_tags

if TYPE_CHECKING:
    from app.routes.v5.api.main.profile.types import (
        SaveProfileApiResponse,
        SaveProfileFieldError,
        SaveProfileItem,
        SaveProfileResult,
    )


# ---------------------------------------------------------------------------
# Value resolution — raw value -> ID via create/search tools
# ---------------------------------------------------------------------------


async def resolve_profile_values(
    conn: asyncpg.Connection | asyncpg.Pool,
    redis: Redis,
    item: SaveProfileItem,
    is_update: bool,
) -> list[SaveProfileFieldError]:
    """Resolve raw value fields to resource IDs (mutates item in place).

    For 'create' resources (name):
      Creates a new resource via the create tool.
    For 'match' resources (departments):
      Searches by name via the search tool, matches exact (case-insensitive).

    Returns a list of errors (empty if all resolved).
    """
    from app.routes.v5.api.main.profile.types import SaveProfileFieldError

    errors: list[SaveProfileFieldError] = []

    # --- Create resources ---

    if item.name is not None and item.name_id is None:
        result = await create_name(conn, item.name, redis)
        item.name_id = result.id

    # --- Match resources ---

    if item.departments is not None and item.department_ids is None:
        all_depts = await search_departments(
            conn,
            redis,
            search=None,
            limit_count=1000,
            profile=True,
        )
        dept_name_map = {d.name.lower(): d.id for d in all_depts if d.name and d.id}
        resolved_ids = []
        for dept_name in item.departments:
            dept_id = dept_name_map.get(dept_name.lower())
            if dept_id:
                resolved_ids.append(dept_id)
            else:
                errors.append(
                    SaveProfileFieldError(
                        field="departments",
                        message=f'Department "{dept_name}" not found',
                    )
                )
        if not any(e.field == "departments" for e in errors):
            item.department_ids = resolved_ids

    # --- Validate required fields (create only) ---

    if not is_update:
        if item.name_id is None:
            errors.append(
                SaveProfileFieldError(field="name", message="Name is required")
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
) -> UUID:
    """Create a profiles_resource snapshot by hydrating IDs to values."""

    async def _empty() -> list:
        return []

    names = (
        await get_names(conn, [name_id], redis, bypass_cache=True)
        if name_id
        else await _empty()
    )

    result = await create_profile_resource(
        conn,
        redis,
        name=names[0].name if names else "",
        description="",
    )
    return result.id


# ---------------------------------------------------------------------------
# save_profile_client — composable infra architecture
# ---------------------------------------------------------------------------


async def save_profile_client(
    pool: asyncpg.Pool,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list[SaveProfileItem],
    group_id: UUID | None = None,
) -> SaveProfileApiResponse:
    """Profile save using composable infra functions.

    Flow:
      1. resolve_profile_identity_context -> role, department_ids
      2. Per-item permission check (fail fast)
      3. Per-item value resolution (raw -> ID)
      4. Single transaction: artifact create/update + denormalized snapshot
      5. invalidate_tags
    """
    from app.infra.profile_permissions import (
        compute_can_create,
        compute_can_edit,
    )
    from app.routes.v5.api.main.profile.types import (
        SaveProfileApiResponse,
        SaveProfileResult,
    )

    # -- Step 1: Profile context --

    profile = await resolve_profile_identity_context(pool, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # -- Step 2: Per-item permission check --

    async with pool.acquire() as conn:
        for idx, item in enumerate(items):
            if item.input_profile_id is not None:
                # Update mode — target_is_self check
                target_is_self = item.input_profile_id == profile_id
                perms = await resolve_profile_permissions_context(
                    conn, item.input_profile_id
                )
                if not perms.exists:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Item {idx}: Profile {item.input_profile_id} not found.",
                    )
                if not compute_can_edit(
                    user_role=profile.role,
                    target_is_self=target_is_self,
                    target_department_ids=perms.department_ids,
                    user_department_ids=profile.department_ids,
                ):
                    raise HTTPException(
                        status_code=403,
                        detail=f"Item {idx}: You don't have permission to save this profile.",
                    )
            else:
                if not compute_can_create(
                    user_role=profile.role, department_ids=None
                ):
                    raise HTTPException(
                        status_code=403,
                        detail=f"Item {idx}: You don't have permission to create a profile.",
                    )

    # -- Step 3: Per-item value resolution --

    has_errors = False
    error_results: list[SaveProfileResult] = []

    async with pool.acquire() as conn:
        for idx, item in enumerate(items):
            item_errors = await resolve_profile_values(
                conn,
                redis,
                item,
                is_update=item.input_profile_id is not None,
            )
            if item_errors:
                has_errors = True
                error_results.append(
                    SaveProfileResult(
                        success=False,
                        message=f"Item {idx}: Validation errors",
                        errors=item_errors,
                    )
                )
            else:
                error_results.append(
                    SaveProfileResult(success=True, message="Validated")
                )

    if has_errors:
        return SaveProfileApiResponse(results=error_results)

    # -- Step 4: Single transaction --

    results: list[SaveProfileResult] = []

    async with pool.acquire() as conn:
        async with conn.transaction():
            for _idx, item in enumerate(items):
                is_update = item.input_profile_id is not None

                # Create denormalized snapshot
                profiles_resource_id = await _create_denormalized_snapshot(
                    conn,
                    redis,
                    name_id=item.name_id,
                )

                if is_update:
                    result = await update_profile_artifact(
                        conn,
                        item.input_profile_id,
                        name_id=item.name_id if item.name_id else _UNSET,
                        request_limit_id=item.request_limit_id
                        if item.request_limit_id
                        else _UNSET,
                        department_ids=item.department_ids,
                        flag_ids=[item.flag_id] if item.flag_id else None,
                        email_ids=item.email_ids,
                        role_ids=item.role_ids,
                        profile_ids=[profiles_resource_id],
                    )
                    out_profile_id = result.id
                else:
                    result = await create_profile_artifact(
                        conn,
                        name_id=item.name_id,
                        request_limit_id=item.request_limit_id,
                        department_ids=item.department_ids,
                        flag_ids=[item.flag_id] if item.flag_id else None,
                        email_ids=item.email_ids,
                        role_ids=item.role_ids,
                        profile_ids=[profiles_resource_id],
                    )
                    out_profile_id = result.id

                results.append(
                    SaveProfileResult(
                        success=True,
                        profile_id=out_profile_id,
                        message="Profile updated successfully"
                        if is_update
                        else "Profile created successfully",
                    )
                )

    # -- Step 5: Invalidate cache --

    await invalidate_tags(["profiles"], redis=redis)

    return SaveProfileApiResponse(results=results)
