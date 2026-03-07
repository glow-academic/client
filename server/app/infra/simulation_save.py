"""Simulation save logic — composable infra architecture.

Core save function that composes existing black-box tools:
  1. resolve_profile_identity_context — profile (role, departments)
  2. resolve_simulation_permissions_context — access check
  3. Resource create/search tools — raw value → ID resolution
  4. Artifact create/update tools — junction writes
  5. Simulation resource create tool — denormalized snapshot
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING
from uuid import UUID

import asyncpg
from fastapi import HTTPException
from redis.asyncio import Redis

from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.simulation_permissions_context import (
    resolve_simulation_permissions_context,
)

# Artifact tools
from app.routes.v5.tools.artifacts.simulation.create import (
    create_simulation as create_simulation_artifact,
)
from app.routes.v5.tools.artifacts.simulation.update import (
    _UNSET,
)
from app.routes.v5.tools.artifacts.simulation.update import (
    update_simulation as update_simulation_artifact,
)

# Resource search tools (match by name → ID)
from app.routes.v5.tools.resources.departments.search import search_departments

# Resource create tools (raw value → ID)
from app.routes.v5.tools.resources.descriptions.create import create_description
from app.routes.v5.tools.resources.descriptions.get import get_descriptions
from app.routes.v5.tools.resources.flags.search import search_flags
from app.routes.v5.tools.resources.names.create import create_name
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.scenarios.search import search_scenarios

# Resource create tool (denormalized snapshot)
from app.routes.v5.tools.resources.simulations.create import (
    create_simulation as create_simulation_resource,
)
from app.utils.cache.invalidate_tags import invalidate_tags

if TYPE_CHECKING:
    from app.routes.v5.api.main.simulation.types import (
        SaveSimulationApiResponse,
        SaveSimulationFieldError,
        SaveSimulationItem,
        SaveSimulationResult,
    )


# ---------------------------------------------------------------------------
# Value resolution — raw value → ID via create/search tools
# ---------------------------------------------------------------------------


async def resolve_simulation_values(
    conn: asyncpg.Connection,
    redis: Redis,
    item: SaveSimulationItem,
    is_update: bool,
) -> list[SaveSimulationFieldError]:
    """Resolve raw value fields to resource IDs (mutates item in place).

    For 'create' resources (name, description):
      Creates a new resource via the create tool.
    For 'match' resources (departments, scenarios, flags):
      Searches by name via the search tool, matches exact (case-insensitive).

    Returns a list of errors (empty if all resolved).
    """
    from app.routes.v5.api.main.simulation.types import SaveSimulationFieldError

    errors: list[SaveSimulationFieldError] = []

    # --- Create resources ---

    if item.name is not None and item.name_id is None:
        result = await create_name(conn, item.name, redis)
        item.name_id = result.id

    if item.description is not None and item.description_id is None:
        result = await create_description(conn, item.description, redis)
        item.description_id = result.id

    # --- Match resources ---

    if item.is_inactive is not None and item.flag_ids is None:
        results = await search_flags(
            conn,
            redis,
            search=None,
            flag_type="simulation_inactive",
            limit_count=1000,
            simulation=True,
        )
        match = next((f for f in results if f.type == "simulation_inactive"), None)
        if match and match.id:
            if item.is_inactive:
                item.flag_ids = [match.id]
        elif item.is_inactive:
            errors.append(
                SaveSimulationFieldError(
                    field="is_inactive", message="Inactive flag resource not found"
                )
            )

    if item.is_practice is not None:
        results = await search_flags(
            conn,
            redis,
            search=None,
            flag_type="simulation_practice",
            limit_count=1000,
            simulation=True,
        )
        match = next((f for f in results if f.type == "simulation_practice"), None)
        if match and match.id:
            if item.is_practice:
                item.flag_ids = (item.flag_ids or []) + [match.id]
        elif item.is_practice:
            errors.append(
                SaveSimulationFieldError(
                    field="is_practice",
                    message="Practice flag resource not found",
                )
            )

    if item.departments is not None and item.department_ids is None:
        all_depts = await search_departments(
            conn,
            redis,
            search=None,
            limit_count=1000,
            simulation=True,
        )
        dept_name_map = {d.name.lower(): d.id for d in all_depts if d.name and d.id}
        resolved_ids = []
        for dept_name in item.departments:
            dept_id = dept_name_map.get(dept_name.lower())
            if dept_id:
                resolved_ids.append(dept_id)
            else:
                errors.append(
                    SaveSimulationFieldError(
                        field="departments",
                        message=f'Department "{dept_name}" not found',
                    )
                )
        if not any(e.field == "departments" for e in errors):
            item.department_ids = resolved_ids

    if item.scenarios is not None and item.scenario_ids is None:
        all_scenarios = await search_scenarios(
            conn,
            redis,
            search=None,
            limit_count=1000,
            simulation=True,
        )
        scenario_name_map = {
            s.name.lower(): s.id for s in all_scenarios if s.name and s.id
        }
        resolved_ids = []
        for scenario_name in item.scenarios:
            sid = scenario_name_map.get(scenario_name.lower())
            if sid:
                resolved_ids.append(sid)
            else:
                errors.append(
                    SaveSimulationFieldError(
                        field="scenarios",
                        message=f'Scenario "{scenario_name}" not found',
                    )
                )
        if not any(e.field == "scenarios" for e in errors):
            item.scenario_ids = resolved_ids

    # --- Validate required fields ---

    if item.name_id is None:
        errors.append(
            SaveSimulationFieldError(field="name", message="Name is required")
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
    """Create a simulations_resource snapshot by hydrating IDs to values."""

    async def _empty() -> list:
        return []

    names, descriptions = await asyncio.gather(
        get_names(conn, [name_id], redis, bypass_cache=True) if name_id else _empty(),
        get_descriptions(conn, [description_id], redis, bypass_cache=True)
        if description_id
        else _empty(),
    )

    result = await create_simulation_resource(
        conn,
        redis,
        name=names[0].name if names else "",
        description=descriptions[0].description if descriptions else "",
    )
    return result.id


# ---------------------------------------------------------------------------
# save_simulation_client — composable infra architecture
# ---------------------------------------------------------------------------


async def save_simulation_client(
    conn: asyncpg.Connection,
    redis: Redis,
    *,
    profile_id: UUID,
    items: list[SaveSimulationItem],
    group_id: UUID | None = None,
) -> SaveSimulationApiResponse:
    """Simulation save using composable infra functions.

    Flow:
      1. resolve_profile_identity_context → role, department_ids
      2. Per-item permission check (fail fast)
      3. Per-item value resolution (raw → ID)
      4. Single transaction: artifact create/update + denormalized snapshot
      5. invalidate_tags
    """
    from app.routes.v5.api.main.simulation.permissions import (
        compute_can_create,
        compute_can_edit,
        has_access,
    )
    from app.routes.v5.api.main.simulation.types import (
        SaveSimulationApiResponse,
        SaveSimulationResult,
    )

    # ── Step 1: Profile context ────────────────────────────────────────

    profile = await resolve_profile_identity_context(conn, profile_id, redis)

    if profile is None:
        raise HTTPException(
            status_code=401,
            detail="Profile not found. Please sign in again.",
        )

    # ── Step 2: Per-item permission check ──────────────────────────────

    for idx, item in enumerate(items):
        if item.input_simulation_id is not None:
            perms = await resolve_simulation_permissions_context(
                conn, item.input_simulation_id
            )
            if not perms.exists:
                raise HTTPException(
                    status_code=404,
                    detail=f"Item {idx}: Simulation {item.input_simulation_id} not found.",
                )
            if not has_access(
                profile.role, profile.department_ids, perms.department_ids
            ):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have access to this simulation.",
                )
            if not compute_can_edit(
                user_role=profile.role,
                simulation_department_ids=perms.department_ids,
                cohort_usage_count=perms.cohort_usage_count,
                user_department_ids=profile.department_ids,
            ):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to save this simulation.",
                )
        else:
            request_department_ids = (
                [str(d) for d in (item.department_ids or [])]
                if item.department_ids
                else []
            )
            if not compute_can_create(profile.role, request_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to create a simulation.",
                )

    # ── Step 3: Per-item value resolution ──────────────────────────────

    has_errors = False
    error_results: list[SaveSimulationResult] = []

    for idx, item in enumerate(items):
        item_errors = await resolve_simulation_values(
            conn,
            redis,
            item,
            is_update=item.input_simulation_id is not None,
        )
        if item_errors:
            has_errors = True
            error_results.append(
                SaveSimulationResult(
                    success=False,
                    message=f"Item {idx}: Validation errors",
                    errors=item_errors,
                )
            )
        else:
            error_results.append(
                SaveSimulationResult(success=True, message="Validated")
            )

    if has_errors:
        return SaveSimulationApiResponse(results=error_results)

    # ── Step 4: Single transaction ─────────────────────────────────────

    results: list[SaveSimulationResult] = []

    async with conn.transaction():
        for item in items:
            is_update = item.input_simulation_id is not None

            # Create denormalized snapshot
            simulations_resource_id = await _create_denormalized_snapshot(
                conn,
                redis,
                name_id=item.name_id,
                description_id=item.description_id,
            )

            if is_update:
                result = await update_simulation_artifact(
                    conn,
                    item.input_simulation_id,
                    name_id=item.name_id if item.name_id else _UNSET,
                    description_id=item.description_id
                    if item.description_id
                    else _UNSET,
                    department_ids=item.department_ids,
                    flag_ids=item.flag_ids,
                    scenario_ids=item.scenario_ids,
                    scenario_flag_ids=item.scenario_flag_ids,
                    scenario_position_ids=item.scenario_position_ids,
                    scenario_rubric_ids=item.scenario_rubric_ids,
                    scenario_time_limit_ids=item.scenario_time_limit_ids,
                    simulation_ids=[simulations_resource_id],
                )
                simulation_id = result.id
            else:
                result = await create_simulation_artifact(
                    conn,
                    name_id=item.name_id,
                    description_id=item.description_id,
                    department_ids=item.department_ids,
                    flag_ids=item.flag_ids,
                    scenario_ids=item.scenario_ids,
                    scenario_flag_ids=item.scenario_flag_ids,
                    scenario_position_ids=item.scenario_position_ids,
                    scenario_rubric_ids=item.scenario_rubric_ids,
                    scenario_time_limit_ids=item.scenario_time_limit_ids,
                    simulation_ids=[simulations_resource_id],
                )
                simulation_id = result.id

            results.append(
                SaveSimulationResult(
                    success=True,
                    simulation_id=simulation_id,
                    message="Simulation updated successfully"
                    if is_update
                    else "Simulation created successfully",
                )
            )

    # ── Step 5: Invalidate cache ───────────────────────────────────────

    await invalidate_tags(["simulations"], redis=redis)

    return SaveSimulationApiResponse(results=results)
