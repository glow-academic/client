"""Cohort get endpoint - v4 API following DHH principles.
Unified endpoint that handles both new (cohort_id = NULL) and detail (cohort_id provided).
Two-pass architecture with Python-computed permissions.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.cohort.permissions import (
    compute_can_edit,
    compute_departments_required,
    compute_description_required,
    compute_disabled_reason,
    compute_flag_required,
    compute_name_required,
    compute_show_departments,
    compute_show_description,
    compute_show_flag,
    compute_show_name,
    compute_show_simulation_positions,
    compute_show_simulations,
    compute_simulation_positions_required,
    compute_simulations_required,
    has_access,
)
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.descriptions.get import get_descriptions_internal
from app.api.v4.resources.flags.get import get_flags_internal
from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.simulation_positions.get import (
    get_simulation_positions_internal,
)
from app.api.v4.resources.simulations.get import get_simulation_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetCohortAccessSqlParams,
    GetCohortAccessSqlRow,
    GetCohortApiRequest,
    GetCohortApiResponse,
    GetCohortSqlParams,
    GetCohortSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/cohorts/get_cohort_complete.sql"
ACCESS_SQL_PATH = "app/sql/v4/queries/cohorts/get_cohort_access_complete.sql"


router = APIRouter()


@router.post(
    "/get",
    response_model=GetCohortApiResponse,
    dependencies=[
        audit_activity(
            "cohort.get",
            "{{ actor.name }} {% if cohort %}viewed{% else %}opened new{% endif %} cohort{% if cohort %} '{{ cohort.name }}'{% endif %}",
        )
    ],
)
async def get_cohort(
    request: GetCohortApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetCohortApiResponse:
    """Get cohort information - handles both new (cohort_id = NULL) and detail (cohort_id provided).

    Two-pass architecture:
    - Query 1: access check (role + department access)
    - Query 2: ID + search data (resource IDs + suggestions)
    - Pass 2: resource fetching by IDs for cache reuse

    Permissions + UI flags computed in Python.
    """
    tags = ["cohorts"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    # Use mode='json' to serialize UUIDs to strings for JSON compatibility
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetCohortApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Extract search and filter params from API request
        descriptions_search = request.descriptions_search
        simulation_search = request.simulation_search
        simulation_show_selected = request.simulation_show_selected
        current_simulation_ids = request.current_simulation_ids
        draft_id = request.draft_id
        cohort_id = request.cohort_id  # Can be NULL for new mode

        # Get mcp flag from header (set by router-level dependency)
        mcp = getattr(http_request.state, "mcp", False) or False

        # === QUERY 1: Access Check ===
        access_params = GetCohortAccessSqlParams(
            profile_id=profile_id,
            cohort_id=cohort_id,
            draft_id=draft_id,
        )
        access_result = cast(
            GetCohortAccessSqlRow,
            await execute_sql_typed(
                conn,
                ACCESS_SQL_PATH,
                params=access_params,
            ),
        )

        user_role = access_result.user_role
        user_department_ids = access_result.user_department_ids or []
        cohort_department_ids = access_result.cohort_department_ids or []

        # Convert API request to SQL params (add profile_id and mcp from header)
        params = GetCohortSqlParams(
            cohort_id=cohort_id,
            profile_id=profile_id,
            descriptions_search=descriptions_search,
            simulation_search=simulation_search,
            simulation_show_selected=simulation_show_selected,
            current_simulation_ids=current_simulation_ids,
            draft_id=draft_id,
            mcp=mcp,
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = cast(
            GetCohortSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
            # Only add cohort to audit context if cohort_id was provided (detail mode)
            if cohort_id and result.name_resource and result.name_resource.name:
                audit_ctx["cohort"] = {
                    "name": result.name_resource.name,
                    "id": str(cohort_id),
                }
            audit_set(http_request, **audit_ctx)

        # Conditional validation based on mode
        if cohort_id is None:
            # New mode: check for valid departments (derive from departments array)
            departments_list = result.departments or []
            valid_department_ids = [
                d.department_id for d in departments_list if d.department_id
            ]
            if user_role == "superadmin":
                valid_department_ids = valid_department_ids or user_department_ids
            if not valid_department_ids and user_department_ids:
                valid_department_ids = user_department_ids
            if not valid_department_ids:
                raise HTTPException(
                    status_code=400, detail="No accessible departments found for user"
                )
        else:
            # Detail mode: check if cohort exists and has access
            if access_result.cohort_exists is False:
                raise HTTPException(
                    status_code=404, detail=f"Cohort {cohort_id} not found"
                )

            if not has_access(user_role, user_department_ids, cohort_department_ids):
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this cohort. It may be restricted to other departments.",
                )

        # === PYTHON PERMISSIONS & UI FLAGS ===
        can_edit = compute_can_edit(user_role, cohort_department_ids)
        disabled_reason = compute_disabled_reason(user_role, cohort_department_ids)

        # Show flags based on available resources
        departments_count = len(result.departments or [])
        simulations_count = len(result.simulations or [])
        simulation_positions_count = len(result.simulation_positions or [])

        show_name = compute_show_name()
        show_description = compute_show_description()
        show_flag = compute_show_flag()
        show_departments = compute_show_departments(departments_count)
        show_simulations = compute_show_simulations(simulations_count)
        show_simulation_positions = compute_show_simulation_positions(
            simulation_positions_count
        )

        # Required flags
        name_required = compute_name_required()
        description_required = compute_description_required()
        flag_required = compute_flag_required()
        departments_required = compute_departments_required(show_departments)
        simulations_required = compute_simulations_required()
        simulation_positions_required = compute_simulation_positions_required()

        # === RESOURCE FETCHING (by IDs for cache reuse) ===
        pool = await get_pool()

        def _ids_from_resource_list(
            items: list[Any] | None, id_attr: str
        ) -> list[UUID]:
            if not items:
                return []
            return [
                getattr(item, id_attr) for item in items if getattr(item, id_attr, None)
            ]

        def _order_by_ids(
            items: list[Any], id_attr: str, ordered_ids: list[UUID]
        ) -> list[Any]:
            by_id = {
                getattr(item, id_attr): item
                for item in items
                if getattr(item, id_attr, None)
            }
            return [by_id[i] for i in ordered_ids if i in by_id]

        async def _run_with_pool(fn, *args):
            async with pool.acquire() as pooled_conn:
                return await fn(pooled_conn, *args, bypass_cache=bypass_cache)

        # Selected resource IDs
        name_ids = [result.name_id] if result.name_id else []
        description_ids = [result.description_id] if result.description_id else []
        flag_ids = [result.active_flag_id] if result.active_flag_id else []
        department_ids = result.department_ids or []
        simulation_ids_raw = result.simulation_ids or []
        simulation_ids = [
            UUID(sid) if isinstance(sid, str) else sid
            for sid in simulation_ids_raw
            if sid is not None
        ]

        # Search result IDs from SQL (for options lists)
        name_option_ids = _ids_from_resource_list(result.names, "id")
        description_option_ids = _ids_from_resource_list(result.descriptions, "id")
        department_option_ids = _ids_from_resource_list(
            result.departments, "department_id"
        )
        simulation_option_ids = _ids_from_resource_list(
            result.simulations, "simulation_id"
        )

        # Fetch resources in parallel
        (
            name_items,
            description_items,
            flag_items,
            department_items,
            simulation_items,
            name_options,
            description_options,
            department_options,
            simulation_options,
            simulation_positions,
        ) = await asyncio.gather(
            _run_with_pool(get_names_internal, name_ids),
            _run_with_pool(get_descriptions_internal, description_ids),
            _run_with_pool(get_flags_internal, flag_ids),
            _run_with_pool(get_departments_internal, department_ids),
            asyncio.gather(
                *[
                    _run_with_pool(get_simulation_internal, sim_id)
                    for sim_id in simulation_ids
                ]
            ),
            _run_with_pool(get_names_internal, name_option_ids),
            _run_with_pool(get_descriptions_internal, description_option_ids),
            _run_with_pool(get_departments_internal, department_option_ids),
            asyncio.gather(
                *[
                    _run_with_pool(get_simulation_internal, sim_id)
                    for sim_id in simulation_option_ids
                ]
            ),
            _run_with_pool(get_simulation_positions_internal, simulation_ids),
        )

        # Normalize single-resource selections
        def _to_dict(item: Any) -> dict[str, Any]:
            if hasattr(item, "model_dump"):
                return item.model_dump()
            return dict(item)

        name_resource = _to_dict(name_items[0]) if name_items else None
        description_resource = (
            _to_dict(description_items[0]) if description_items else None
        )
        flag_resource = _to_dict(flag_items[0]) if flag_items else None

        # Ordered option lists
        names = [
            _to_dict(item)
            for item in _order_by_ids(name_options, "id", name_option_ids)
        ]
        descriptions = [
            _to_dict(item)
            for item in _order_by_ids(description_options, "id", description_option_ids)
        ]
        departments = [
            _to_dict(item)
            for item in _order_by_ids(
                department_options, "department_id", department_option_ids
            )
        ]
        simulations = [
            _to_dict(item)
            for item in _order_by_ids(
                [item for item in simulation_options if item],
                "simulation_id",
                simulation_option_ids,
            )
        ]

        # Build response with Python-computed permissions and fetched resources
        result_dict = result.model_dump(mode="json")
        result_dict.update(
            {
                "can_edit": can_edit,
                "disabled_reason": disabled_reason,
                "show_name": show_name,
                "show_description": show_description,
                "show_flag": show_flag,
                "show_departments": show_departments,
                "show_simulations": show_simulations,
                "show_simulation_positions": show_simulation_positions,
                "name_required": name_required,
                "description_required": description_required,
                "flag_required": flag_required,
                "departments_required": departments_required,
                "simulations_required": simulations_required,
                "simulation_positions_required": simulation_positions_required,
                "name_resource": name_resource,
                "description_resource": description_resource,
                "flag_resource": flag_resource,
                "department_resources": [
                    _to_dict(item)
                    for item in _order_by_ids(
                        department_items, "department_id", department_ids
                    )
                ],
                "simulation_resources": [
                    _to_dict(item)
                    for item in _order_by_ids(
                        [item for item in simulation_items if item],
                        "simulation_id",
                        simulation_ids,
                    )
                ],
                "simulation_positions": simulation_positions or [],
                "names": names,
                "descriptions": descriptions,
                "departments": departments,
                "simulations": simulations,
            }
        )

        response_data = GetCohortApiResponse.model_validate(result_dict)

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_cohort",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
