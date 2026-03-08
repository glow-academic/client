"""Parameter save logic — composable infra architecture.

Core save function that composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. resolve_parameter_permissions_context — access check
  3. Resource create/search tools — raw value -> ID resolution
  4. Artifact create/update tools — junction writes
  5. Parameter resource create tool — denormalized snapshot
"""

from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.parameter_permissions_context import (
    resolve_parameter_permissions_context,
)
from app.infra.profile_identity_context import resolve_profile_identity_context

# Artifact tools
from app.routes.v5.tools.artifacts.parameter.create import (
    create_parameter as create_parameter_artifact,
)
from app.routes.v5.tools.artifacts.parameter.update import (
    _UNSET,
)
from app.routes.v5.tools.artifacts.parameter.update import (
    update_parameter as update_parameter_artifact,
)

# Resource search tools (match by name -> ID)
from app.routes.v5.tools.resources.departments.search import search_departments

# Resource create tools (raw value -> ID)
from app.routes.v5.tools.resources.descriptions.create import create_description
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.names.create import create_name
from app.routes.v5.tools.resources.names.get import get_names

# Resource create tool (denormalized snapshot)
from app.routes.v5.tools.resources.parameters.create import (
    create_parameter as create_parameter_resource,
)
from app.utils.cache.invalidate_tags import invalidate_tags

if TYPE_CHECKING:
    from app.routes.v5.api.main.parameter.types import (
        SaveParameterApiResponse,
        SaveParameterFieldError,
        SaveParameterItem,
        SaveParameterResult,
    )


# ---------------------------------------------------------------------------
# Value resolution — raw value -> ID via create/search tools
# ---------------------------------------------------------------------------


async def resolve_parameter_values(
    conn: asyncpg.Connection,
    redis: Redis,
    item: SaveParameterItem,
    is_update: bool,
) -> list[SaveParameterFieldError]:
    """Resolve raw value fields to resource IDs (mutates item in place).

    For 'create' resources (name, description):
      Creates a new resource via the create tool.
    For 'match' resources (departments):
      Searches by name via the search tool, matches exact (case-insensitive).

    Returns a list of errors (empty if all resolved).
    """
    from app.routes.v5.api.main.parameter.types import SaveParameterFieldError

    errors: list[SaveParameterFieldError] = []

    # --- Create resources ---

    if item.name is not None and item.name_id is None:
        result = await create_name(conn, item.name, redis)
        item.name_id = result.id

    if item.description is not None and item.description_id is None:
        result = await create_description(conn, item.description, redis)
        item.description_id = result.id

    # --- Match resources ---

    if item.departments is not None and item.department_ids is None:
        all_depts = await search_departments(
            conn,
            redis,
            search=None,
            limit_count=1000,
            parameter=True,
        )
        dept_name_map = {d.name.lower(): d.id for d in all_depts if d.name and d.id}
        resolved_ids = []
        for dept_name in item.departments:
            dept_id = dept_name_map.get(dept_name.lower())
            if dept_id:
                resolved_ids.append(dept_id)
            else:
                errors.append(
                    SaveParameterFieldError(
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
                SaveParameterFieldError(field="name", message="Name is required")
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
    """Create a parameters_resource snapshot by hydrating IDs to values."""
    import asyncio

    async def _empty() -> list:
        return []

    names, descriptions = await asyncio.gather(
        get_names(conn, [name_id], redis, bypass_cache=True) if name_id else _empty(),
        get_descriptions(conn, [description_id], redis, bypass_cache=True)
        if description_id
        else _empty(),
    )

    result = await create_parameter_resource(
        conn,
        redis,
        name=names[0].name if names else "",
        description=descriptions[0].description if descriptions else "",
    )
    return result.id


# ---------------------------------------------------------------------------
# save_parameter_client — composable infra architecture
# ---------------------------------------------------------------------------


async def save_parameter_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list[SaveParameterItem],
    group_id: UUID | None = None,
) -> SaveParameterApiResponse:
    """Parameter save using composable infra functions.

    Flow:
      1. resolve_profile_identity_context -> role, department_ids
      2. Per-item permission check (fail fast)
      3. Per-item value resolution (raw -> ID)
      4. Single transaction: artifact create/update + denormalized snapshot
      5. invalidate_tags
    """
    from app.routes.v5.api.main.parameter.permissions import (
        compute_can_create,
        compute_can_edit,
    )
    from app.routes.v5.api.main.parameter.types import (
        SaveParameterApiResponse,
        SaveParameterResult,
    )

    # -- Step 1: Profile context --

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # -- Step 2: Per-item permission check --

    for idx, item in enumerate(items):
        if item.input_parameter_id is not None:
            perms = await resolve_parameter_permissions_context(
                conn, item.input_parameter_id
            )
            if not perms.exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Item {idx}: Parameter {item.input_parameter_id} not found.",
                )
            if not compute_can_edit(
                user_role=profile.role,
                parameter_department_ids=perms.department_ids,
                active_scenario_count=perms.active_scenario_count,
                user_department_ids=profile.department_ids,
            ):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to save this parameter.",
                )
        else:
            if not compute_can_create(user_role=profile.role, department_ids=None):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to create a parameter.",
                )

    # -- Step 3: Per-item value resolution --

    has_errors = False
    error_results: list[SaveParameterResult] = []

    for idx, item in enumerate(items):
        item_errors = await resolve_parameter_values(
            conn,
            redis,
            item,
            is_update=item.input_parameter_id is not None,
        )
        if item_errors:
            has_errors = True
            error_results.append(
                SaveParameterResult(
                    success=False,
                    message=f"Item {idx}: Validation errors",
                    errors=item_errors,
                )
            )
        else:
            error_results.append(SaveParameterResult(success=True, message="Validated"))

    if has_errors:
        return SaveParameterApiResponse(results=error_results)

    # -- Step 4: Single transaction --

    results: list[SaveParameterResult] = []

    async with conn.transaction():
        for _idx, item in enumerate(items):
            is_update = item.input_parameter_id is not None

            # Create denormalized snapshot
            parameters_resource_id = await _create_denormalized_snapshot(
                conn,
                redis,
                name_id=item.name_id,
                description_id=item.description_id,
            )

            if is_update:
                result = await update_parameter_artifact(
                    conn,
                    item.input_parameter_id,
                    name_id=item.name_id if item.name_id else _UNSET,
                    description_id=item.description_id
                    if item.description_id
                    else _UNSET,
                    department_ids=item.department_ids,
                    flag_ids=item.flag_ids,
                    field_ids=item.field_ids,
                    parameter_ids=[parameters_resource_id],
                )
                parameter_id = result.id
            else:
                result = await create_parameter_artifact(
                    conn,
                    name_id=item.name_id,
                    description_id=item.description_id,
                    department_ids=item.department_ids,
                    flag_ids=item.flag_ids,
                    field_ids=item.field_ids,
                    parameter_ids=[parameters_resource_id],
                )
                parameter_id = result.id

            results.append(
                SaveParameterResult(
                    success=True,
                    parameter_id=parameter_id,
                    message="Parameter updated successfully"
                    if is_update
                    else "Parameter created successfully",
                )
            )

    # -- Step 5: Invalidate cache --

    await invalidate_tags(["parameters"], redis=redis)

    return SaveParameterApiResponse(results=results)
