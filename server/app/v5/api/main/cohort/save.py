"""Cohort save endpoint - v4 API following DHH principles.
Unified endpoint that handles both create (cohort_id = NULL) and update (cohort_id provided).
Supports bulk operations and dual-mode fields (ID or value).
"""

import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.cohort.permissions import (
    COHORT_RESOURCES,
    compute_can_create,
    compute_can_edit,
    has_access,
)
from app.v5.api.main.cohort.types import (
    SaveCohortApiRequest,
    SaveCohortApiResponse,
    SaveCohortFieldError,
    SaveCohortItem,
    SaveCohortResult,
    SaveCohortSqlParams,
    SaveCohortSqlRow,
)
from app.v5.api.auth.settings import get_auth_settings_internal
from app.v5.api.permissions import resolve_agents_for_artifact
from app.v5.api.resources.cohorts.create import create_cohorts_internal
from app.v5.api.resources.descriptions.create import create_descriptions_internal
from app.v5.api.resources.names.create import create_names_internal
from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db, get_pool
from app.v5.sql.types import (
    GetCohortAccessSqlParams,
    GetCohortAccessSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.logging.db_logger import get_logger
from app.v5.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

# SQL paths
ACCESS_SQL_PATH = "app/v5/sql/queries/cohorts/get_cohort_access_complete.sql"
SQL_PATH = "app/v5/sql/queries/cohorts/save_cohort_complete.sql"

router = APIRouter()


async def save_cohort_internal(
    conn: asyncpg.Connection,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None,
    resource_actions: dict[str, Any],
    cohort_id: uuid.UUID | None = None,
) -> uuid.UUID | None:
    """Save a cohort from resource actions dict (used by generation complete handler).

    Extracts flat resource IDs from resource_actions, creates the denormalized
    cohorts_resource, then executes the save SQL in a transaction.

    Returns the cohort_id on success, None on failure.
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
        flag_id = _id("flags")
        department_ids = _ids("departments")
        simulation_ids = _ids("simulations")
        simulation_position_ids = _ids("simulation_positions")
        simulation_availability_ids = _ids("simulation_availability")
        profile_ids = _ids("profiles")
        profile_persona_ids = _ids("profile_personas")

        async with conn.transaction():
            # Create denormalized cohorts_resource
            cohorts_resource_id = await create_cohorts_internal(
                conn,
                name_id=name_id,
                description_id=description_id,
                department_ids=department_ids,
                simulation_ids=simulation_ids,
                profile_ids=profile_ids,
                profile_persona_ids=profile_persona_ids,
            )

            params = SaveCohortSqlParams(
                profile_id=profile_id,
                input_cohort_id=cohort_id,
                name_id=name_id,
                description_id=description_id,
                active_flag_id=flag_id,
                department_ids=department_ids,
                simulation_ids=simulation_ids,
                simulation_position_ids=simulation_position_ids,
                simulation_availability_ids=simulation_availability_ids,
                profile_ids=profile_ids,
                profile_persona_ids=profile_persona_ids,
                cohorts_resource_id=cohorts_resource_id,
            )

            result = cast(
                SaveCohortSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.cohort_id:
                return None

        await invalidate_tags(["cohorts"])

        # Sync entry rows (fire-and-forget — failure should not fail the save)
        try:
            from app.v5.api.main.cohort.sync import sync_cohort_entries

            await sync_cohort_entries(
                conn=conn,
                cohorts_resource_id=cohorts_resource_id,
                simulation_ids=simulation_ids or [],
                simulation_position_ids=simulation_position_ids or [],
                simulation_availability_ids=simulation_availability_ids or [],
                department_ids=department_ids or [],
                profile_ids=profile_ids or [],
                profile_persona_ids=profile_persona_ids or [],
            )
        except Exception as sync_err:
            logger.warning(f"sync_cohort_entries failed (non-fatal): {sync_err}")

        return result.cohort_id

    except Exception as e:
        logger.exception(f"save_cohort_internal failed: {e}")
        return None


async def _resolve_cohort_values(
    conn: asyncpg.Connection,
    item: SaveCohortItem,
    group_id: uuid.UUID | None = None,
    create_tool_ids: dict[str, uuid.UUID | None] | None = None,
) -> list[SaveCohortFieldError]:
    """Resolve value fields to IDs on the item (mutates in place).

    For 'create' resources (name, description):
      Creates a new resource and sets the *_id field.
      When group_id and create_tool_ids are provided, tool tracking is recorded.

    Returns a list of errors (empty if all resolved successfully).
    """
    errors: list[SaveCohortFieldError] = []

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

    if item.is_inactive is not None and item.flag_id is None:
        from app.v5.api.resources.flags.search import search_flags_internal

        all_flags = await search_flags_internal(
            conn,
            search=None,
            limit_count=1000,
            flag_type="cohort_active",
            cohort=True,
        )
        match = next((f for f in all_flags if f.type == "cohort_active"), None)
        if match and match.id:
            if not item.is_inactive:
                # Active → set the cohort_active flag
                item.flag_id = match.id
            # Inactive → leave flag_id as None (no flag)
        elif not item.is_inactive:
            errors.append(
                SaveCohortFieldError(
                    field="is_inactive", message="Active flag resource not found"
                )
            )

    if item.departments is not None and item.department_ids is None:
        from app.v5.api.resources.departments.search import (
            search_departments_internal,
        )

        all_depts = await search_departments_internal(
            conn, search=None, limit_count=1000, cohort=True
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
                    SaveCohortFieldError(
                        field="departments",
                        message=f'Department "{dept_name}" not found',
                    )
                )
        if not any(e.field == "departments" for e in errors):
            item.department_ids = resolved_ids

    if item.simulations is not None and item.simulation_ids is None:
        from app.v5.api.resources.simulations.search import (
            search_simulations_internal,
        )

        all_simulations = await search_simulations_internal(
            conn, search=None, limit_count=1000, cohort=True
        )
        sim_name_map = {
            s.name.lower(): s.simulation_id
            for s in all_simulations
            if s.name and s.simulation_id
        }
        resolved_ids = []
        for sim_name in item.simulations:
            sid = sim_name_map.get(sim_name.lower())
            if sid:
                resolved_ids.append(sid)
            else:
                errors.append(
                    SaveCohortFieldError(
                        field="simulations",
                        message=f'Simulation "{sim_name}" not found',
                    )
                )
        if not any(e.field == "simulations" for e in errors):
            item.simulation_ids = resolved_ids

    if item.profiles is not None and item.profile_ids is None:
        from app.v5.api.resources.profiles.search import (
            search_profiles_internal,
        )

        all_profiles = await search_profiles_internal(
            conn, search=None, limit_count=1000
        )
        profile_name_map = {
            p.name.lower(): p.profile_id
            for p in all_profiles
            if p.name and p.profile_id
        }
        resolved_ids = []
        for profile_name in item.profiles:
            pid = profile_name_map.get(profile_name.lower())
            if pid:
                resolved_ids.append(pid)
            else:
                errors.append(
                    SaveCohortFieldError(
                        field="profiles",
                        message=f'Profile "{profile_name}" not found',
                    )
                )
        if not any(e.field == "profiles" for e in errors):
            item.profile_ids = resolved_ids

    # --- Validate required fields have IDs after resolution ---

    if item.name_id is None:
        errors.append(SaveCohortFieldError(field="name", message="Name is required"))

    return errors


@router.post("/save", response_model=SaveCohortApiResponse)
async def save_cohort(
    request: SaveCohortApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SaveCohortApiResponse:
    """Bulk save cohorts — all-or-nothing single transaction.

    Each item can provide resource IDs directly or raw values that get
    resolved to IDs (create or match). If any item has resolution errors,
    the entire batch fails with per-item error details — no mutation occurs.
    """
    tags = ["cohorts"]

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
        from app.v5.api.auth.profile import get_auth_profile_internal

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
                settings_data.agent_tool_entries, COHORT_RESOURCES
            )

        # Phase 1: Per-item access + permission checks (outside transaction, fail fast)
        for idx, item in enumerate(request.cohorts):
            if not item.input_cohort_id:
                # Create mode
                request_department_ids = (
                    [str(d) for d in (item.department_ids or [])]
                    if item.department_ids
                    else []
                )
                can_save = compute_can_create(user_role, request_department_ids)
            else:
                # Update mode
                access_params = GetCohortAccessSqlParams(
                    profile_id=profile_id,
                    cohort_id=item.input_cohort_id,
                )
                access_result = cast(
                    GetCohortAccessSqlRow,
                    await execute_sql_typed(
                        conn, ACCESS_SQL_PATH, params=access_params
                    ),
                )

                if not access_result:
                    raise HTTPException(
                        status_code=401,
                        detail=f"Item {idx}: Unable to verify user permissions.",
                    )

                cohort_department_ids = (
                    getattr(access_result, "cohort_department_ids", None) or []
                )

                if access_result.cohort_exists is False:
                    raise HTTPException(
                        status_code=404,
                        detail=f"Item {idx}: Cohort {item.input_cohort_id} not found",
                    )

                if not has_access(
                    user_role, user_department_ids, cohort_department_ids
                ):
                    raise HTTPException(
                        status_code=403,
                        detail=f"Item {idx}: You don't have access to this cohort.",
                    )

                can_save = compute_can_edit(
                    user_role=user_role,
                    cohort_department_ids=cohort_department_ids,
                    user_department_ids=user_department_ids,
                )

            if not can_save:
                raise HTTPException(
                    status_code=403,
                    detail=f"Item {idx}: You don't have permission to save this cohort.",
                )

        # Phase 2: Resolve value fields → IDs (outside transaction)
        has_errors = False
        error_results: list[SaveCohortResult] = []

        for idx, item in enumerate(request.cohorts):
            item_errors = await _resolve_cohort_values(
                conn,
                item,
                group_id=request.group_id,
                create_tool_ids=create_tool_ids,
            )
            if item_errors:
                has_errors = True
                error_results.append(
                    SaveCohortResult(
                        success=False,
                        message=f"Item {idx}: Validation errors",
                        errors=item_errors,
                    )
                )
            else:
                error_results.append(
                    SaveCohortResult(
                        success=True,
                        message="Validated",
                    )
                )

        if has_errors:
            return SaveCohortApiResponse(results=error_results)

        # Phase 3: Single transaction — create resources + save junctions
        results: list[SaveCohortResult] = []
        sync_items: list[tuple[uuid.UUID, SaveCohortItem]] = []

        async with conn.transaction():
            for idx, item in enumerate(request.cohorts):
                # Create denormalized cohorts_resource
                cohorts_resource_id = await create_cohorts_internal(
                    conn,
                    name_id=item.name_id,
                    description_id=item.description_id,
                    department_ids=item.department_ids,
                    simulation_ids=item.simulation_ids,
                    profile_ids=item.profile_ids,
                    profile_persona_ids=item.profile_persona_ids,
                )

                params = SaveCohortSqlParams.from_request(
                    item,
                    profile_id=profile_id,
                    cohorts_resource_id=cohorts_resource_id,
                )

                result = cast(
                    SaveCohortSqlRow,
                    await execute_sql_typed(
                        conn,
                        SQL_PATH,
                        params=params,
                    ),
                )

                if not result or not result.cohort_id:
                    if item.input_cohort_id:
                        raise ValueError(
                            f"Item {idx}: Cohort not found: {item.input_cohort_id}"
                        )
                    else:
                        raise ValueError(f"Item {idx}: Failed to create cohort")

                is_update = item.input_cohort_id is not None
                results.append(
                    SaveCohortResult(
                        success=True,
                        cohort_id=result.cohort_id,
                        message="Cohort updated successfully"
                        if is_update
                        else "Cohort created successfully",
                    )
                )
                sync_items.append((cohorts_resource_id, item))

        # Audit context
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        # Sync entry rows for each saved cohort (non-fatal)
        for resource_id, item in sync_items:
            try:
                from app.v5.api.main.cohort.sync import sync_cohort_entries

                await sync_cohort_entries(
                    conn=conn,
                    cohorts_resource_id=resource_id,
                    simulation_ids=item.simulation_ids or [],
                    simulation_position_ids=item.simulation_position_ids or [],
                    simulation_availability_ids=item.simulation_availability_ids or [],
                    department_ids=item.department_ids or [],
                    profile_ids=item.profile_ids or [],
                    profile_persona_ids=item.profile_persona_ids or [],
                )
            except Exception as sync_err:
                logger.warning(f"sync_cohort_entries failed (non-fatal): {sync_err}")

        return SaveCohortApiResponse(results=results)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="save_cohort",
            sql_query=sql_query,
            sql_params=None,
            request=http_request,
        )
