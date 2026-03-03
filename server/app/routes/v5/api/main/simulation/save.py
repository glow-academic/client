"""Simulation save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (simulation_id = NULL) and update (simulation_id provided).
Supports bulk operations and dual-mode fields (ID or value).
"""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.v5.api.main.simulation.permissions import (
    SIMULATION_RESOURCES,
    compute_can_create,
    compute_can_edit,
    has_access,
)
from app.routes.v5.api.main.simulation.types import (
    SaveSimulationApiRequest,
    SaveSimulationApiResponse,
    SaveSimulationFieldError,
    SaveSimulationItem,
    SaveSimulationResult,
    SaveSimulationSqlParams,
    SaveSimulationSqlRow,
)
from app.routes.auth.settings import get_auth_settings_internal
from app.routes.v5.api.permissions import resolve_agents_for_artifact
from app.routes.v5.api.resources.descriptions.create import create_descriptions_internal
from app.routes.v5.tools.resources.names.create import create_names_internal
from app.routes.v5.api.resources.simulations.create import create_simulations_internal
from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db, get_pool
from app.sql.types import (
    CheckSimulationSaveAccessSqlParams,
    CheckSimulationSaveAccessSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths
SQL_PATH = "app/sql/queries/simulations/save_simulation_complete.sql"
ACCESS_SQL_PATH = (
    "app/sql/queries/simulations/check_simulation_save_access_complete.sql"
)

router = APIRouter()


async def save_simulation_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None,
    resource_actions: dict[str, Any],
    simulation_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Save a simulation from resource actions dict (used by generation complete handler).

    Extracts flat resource IDs from resource_actions, creates the denormalized
    simulations_resource, then executes the save SQL in a transaction.

    Returns the simulation_id on success, None on failure.
    """
    try:

        def _id(key: str) -> uuid.UUID | None:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return val.get("resource_id")
            return None

        def _ids(key: str) -> list[uuid.UUID] | None:
            val = resource_actions.get(key, {})
            if isinstance(val, dict):
                return val.get("resource_ids")
            return None

        name_id = _id("names")
        description_id = _id("descriptions")
        flag_ids = _ids("flags")
        department_ids = _ids("departments")
        scenario_ids = _ids("scenarios")
        scenario_flag_ids = _ids("scenario_flags")
        scenario_position_ids = _ids("scenario_positions")
        scenario_rubric_ids = _ids("scenario_rubrics")
        scenario_time_limit_ids = _ids("scenario_time_limits")

        async with conn.transaction():
            # Create denormalized simulations_resource
            simulations_resource_id = await create_simulations_internal(
                conn,
                name_id=name_id,
                description_id=description_id,
                department_ids=department_ids,
                scenario_ids=scenario_ids,
            )

            params = SaveSimulationSqlParams(
                profile_id=profile_id,
                input_simulation_id=simulation_id,
                name_id=name_id,
                description_id=description_id,
                flag_ids=flag_ids,
                department_ids=department_ids,
                scenario_ids=scenario_ids,
                scenario_flag_ids=scenario_flag_ids,
                scenario_position_ids=scenario_position_ids,
                scenario_rubric_ids=scenario_rubric_ids,
                scenario_time_limit_ids=scenario_time_limit_ids,
                simulations_resource_id=simulations_resource_id,
            )

            result = cast(
                SaveSimulationSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.simulation_id:
                return None

        await invalidate_tags(["simulations"])
        return result.simulation_id

    except Exception as e:
        logger.exception(f"save_simulation_internal failed: {e}")
        return None


async def _resolve_simulation_values(
    conn: asyncpg.Connection,
    item: SaveSimulationItem,
    group_id: uuid.UUID | None = None,
    create_tool_ids: dict[str, uuid.UUID | None] | None = None,
) -> list[SaveSimulationFieldError]:
    """Resolve value fields to IDs on the item (mutates in place).

    For 'create' resources (name, description):
      Creates a new resource and sets the *_id field.
      When group_id and create_tool_ids are provided, tool tracking is recorded.

    Returns a list of errors (empty if all resolved successfully).
    """
    errors: list[SaveSimulationFieldError] = []

    # Tool tracking args (only active when both group_id and tool_id are present)
    def _tool_args(resource_key: str) -> dict:
        if group_id and create_tool_ids:
            tool_id = create_tool_ids.get(resource_key)
            if tool_id:
                return {"group_id": group_id, "tool_id": tool_id}
        return {}

    # --- Create resources (always create new) ---

    if item.name is not None and item.name_id is None:
        item.name_id = await create_names_internal(
            conn, item.name, **_tool_args("names")
        )

    if item.description is not None and item.description_id is None:
        item.description_id = await create_descriptions_internal(
            conn, item.description, **_tool_args("descriptions")
        )

    # --- Match-by-name resolution for value fields (CSV import) ---

    if item.is_inactive is not None and item.flag_ids is None:
        from app.routes.v5.api.resources.flags.search import search_flags_internal

        all_flags = await search_flags_internal(
            conn,
            search=None,
            limit_count=1000,
            flag_type="simulation_inactive",
            simulation=True,
        )
        match = next((f for f in all_flags if f.type == "simulation_inactive"), None)
        if match and match.id:
            if item.is_inactive:
                item.flag_ids = [match.id]
        elif item.is_inactive:
            errors.append(
                SaveSimulationFieldError(
                    field="is_inactive", message="Inactive flag resource not found"
                )
            )

    if item.is_practice is not None and item.flag_ids is None:
        from app.routes.v5.api.resources.flags.search import search_flags_internal

        all_flags = await search_flags_internal(
            conn,
            search=None,
            limit_count=1000,
            flag_type="simulation_practice",
            simulation=True,
        )
        match = next((f for f in all_flags if f.type == "simulation_practice"), None)
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
        from app.routes.v5.api.resources.departments.search import (
            search_departments_internal,
        )

        all_depts = await search_departments_internal(
            conn, search=None, limit_count=1000, simulation=True
        )
        dept_name_map = {
            d.name.lower(): d.department_id
            for d in all_depts
            if d.name and d.department_id
        }
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
        from app.routes.v5.api.resources.scenarios.search import (
            search_scenarios_internal,
        )

        all_scenarios = await search_scenarios_internal(
            conn, search=None, limit_count=1000, simulation=True
        )
        scenario_name_map = {
            s.name.lower(): s.scenario_id
            for s in all_scenarios
            if s.name and s.scenario_id
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

    # --- Validate required fields have IDs after resolution ---

    if item.name_id is None:
        errors.append(
            SaveSimulationFieldError(field="name", message="Name is required")
        )

    return errors


@router.post("/save", response_model=SaveSimulationApiResponse)
async def save_simulation(
    request: SaveSimulationApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveSimulationApiResponse:
    """Bulk save simulations — all-or-nothing single transaction.

    Each item can provide resource IDs directly or raw values that get
    resolved to IDs (create or match). If any item has resolution errors,
    the entire batch fails with per-item error details — no mutation occurs.
    """
    tags = ["simulations"]

    sql_query = load_sql_query(SQL_PATH)

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Fetch user context once for the whole batch
        from app.routes.auth.profile import get_auth_profile_internal

        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=False,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
                user_department_ids = [
                    d.department_id for d in profile_ctx.departments if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Resolve create tool IDs from settings (for tool tracking on freeform creates)
        create_tool_ids: dict[str, uuid.UUID | None] | None = None
        if request.group_id and pool:
            async with pool.acquire() as settings_conn:
                settings_data = await get_auth_settings_internal(
                    settings_conn, profile_id, bypass_cache=False
                )
            _, create_tool_ids, _ = resolve_agents_for_artifact(
                settings_data.agent_tool_entries, SIMULATION_RESOURCES
            )

        # Phase 1: Per-item access + permission checks (outside transaction, fail fast)
        for idx, item in enumerate(request.simulations):
            access_params = CheckSimulationSaveAccessSqlParams(
                profile_id=profile_id,
                simulation_id=item.input_simulation_id,
            )
            access_result = cast(
                CheckSimulationSaveAccessSqlRow,
                await execute_sql_typed(
                    conn,
                    ACCESS_SQL_PATH,
                    params=access_params,
                ),
            )

            if not access_result:
                raise HTTPException(
                    status_code=401,
                    detail=f"Item {idx}: Unable to verify user permissions.",
                )

            if not item.input_simulation_id:
                request_department_ids = (
                    [str(d) for d in (item.department_ids or [])]
                    if item.department_ids
                    else []
                )
                can_save = compute_can_create(user_role, request_department_ids)
            else:
                simulation_department_ids = (
                    getattr(access_result, "simulation_department_ids", None) or []
                )
                cohort_usage_count = (
                    getattr(access_result, "cohort_usage_count", 0) or 0
                )
                simulation_exists = getattr(access_result, "simulation_exists", None)

                if simulation_exists is False:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Item {idx}: Simulation {item.input_simulation_id} not found",
                    )

                if not has_access(
                    user_role, user_department_ids, simulation_department_ids
                ):
                    raise HTTPException(
                        status_code=403,
                        detail=f"Item {idx}: You don't have access to this simulation.",
                    )

                can_save = compute_can_edit(
                    user_role=user_role,
                    simulation_department_ids=simulation_department_ids,
                    cohort_usage_count=cohort_usage_count,
                    user_department_ids=user_department_ids,
                )

            if not can_save:
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to save this simulation.",
                )

        # Phase 2: Resolve value fields → IDs (outside transaction)
        has_errors = False
        error_results: list[SaveSimulationResult] = []

        for idx, item in enumerate(request.simulations):
            item_errors = await _resolve_simulation_values(
                conn,
                item,
                group_id=request.group_id,
                create_tool_ids=create_tool_ids,
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
                    SaveSimulationResult(
                        success=True,
                        message="Validated",
                    )
                )

        if has_errors:
            return SaveSimulationApiResponse(results=error_results)

        # Phase 3: Single transaction — create resources + save junctions
        results: list[SaveSimulationResult] = []

        async with conn.transaction():
            for idx, item in enumerate(request.simulations):
                # Create denormalized simulations_resource
                simulations_resource_id = await create_simulations_internal(
                    conn,
                    name_id=item.name_id,
                    description_id=item.description_id,
                    department_ids=item.department_ids,
                    scenario_ids=item.scenario_ids,
                )

                params = SaveSimulationSqlParams.from_request(
                    item,
                    profile_id=profile_id,
                    simulations_resource_id=simulations_resource_id,
                )

                result = cast(
                    SaveSimulationSqlRow,
                    await execute_sql_typed(
                        conn,
                        SQL_PATH,
                        params=params,
                    ),
                )

                if not result or not result.simulation_id:
                    if item.input_simulation_id:
                        raise ValueError(
                            f"Item {idx}: Simulation not found: {item.input_simulation_id}"
                        )
                    else:
                        raise ValueError(f"Item {idx}: Failed to create simulation")

                is_update = item.input_simulation_id is not None
                results.append(
                    SaveSimulationResult(
                        success=True,
                        simulation_id=result.simulation_id,
                        message="Simulation updated successfully"
                        if is_update
                        else "Simulation created successfully",
                    )
                )

        # Audit context
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return SaveSimulationApiResponse(results=results)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="save_simulation",
            sql_query=sql_query,
            sql_params=None,
            request=http_request,
        )
