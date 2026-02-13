"""Rubric list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with department_ids, simulation_ids, and counts
2. Python computes permissions (can_edit, can_delete, can_duplicate)

Filter option names hydrated from cached *_internal() functions.
Search filtering applied in Python for option names.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.rubric.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.api.v4.artifacts.rubric.types import (
    ListRubricApiDepartment,
    ListRubricApiResponse,
    ListRubricApiRubric,
    ListRubricApiSimulationOption,
    ListRubricApiStandard,
    ListRubricApiStandardGroup,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.simulations.get import get_simulations_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetRubricsListApiRequest,
    GetRubricsListSqlParams,
    GetRubricsListSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/rubric/get_rubrics_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=ListRubricApiResponse,
    dependencies=[
        audit_activity("rubrics.list", "{{ actor.name }} visited the Rubrics page")
    ],
)
async def get_rubric_list(
    request: GetRubricsListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListRubricApiResponse:
    """Get rubrics list with hierarchical structure and permissions."""
    tags = ["rubrics"]

    # Check for cache bypass header (for testing)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return ListRubricApiResponse.model_validate(cached["data"])

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

        # Fetch user context for audit logging and permissions
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                profile_ctx = await get_auth_profile_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=bypass_cache,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
        else:
            actor_name = None
            user_role = None

        # Convert API request to SQL params (add profile_id from header + request body fields)
        params = GetRubricsListSqlParams(
            profile_id=profile_id,
            search=request.search,
            filter_department_ids=request.filter_department_ids,
            filter_simulation_ids=request.filter_simulation_ids,
            department_search=request.department_search,
            simulation_search=request.simulation_search,
            page_size=request.page_size,
            page_offset=request.page_offset,
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            GetRubricsListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # Compute permissions for each rubric in Python
        rubrics_with_permissions: list[ListRubricApiRubric] = []
        for rubric in result.rubrics or []:
            can_edit_val = compute_can_edit(
                user_role=user_role,
                rubric_department_ids=rubric.department_ids,
                active_simulation_count=rubric.active_simulation_count or 0,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                rubric_department_ids=rubric.department_ids,
                total_simulation_links=rubric.total_simulation_links or 0,
            )
            can_duplicate_val = compute_can_duplicate(user_role=user_role)

            rubrics_with_permissions.append(
                ListRubricApiRubric(
                    rubric_id=rubric.rubric_id,
                    name=rubric.name,
                    description=rubric.description,
                    points=rubric.points,
                    pass_points=rubric.pass_points,
                    pass_percentage=rubric.pass_percentage,
                    department_ids=rubric.department_ids,
                    simulation_ids=rubric.simulation_ids,
                    active_simulation_count=rubric.active_simulation_count,
                    total_simulation_links=rubric.total_simulation_links,
                    can_edit=can_edit_val,
                    can_delete=can_delete_val,
                    can_duplicate=can_duplicate_val,
                    standard_group_ids=rubric.standard_group_ids,
                )
            )

        # Pass through standard groups and standards from SQL (rubric's own junction data)
        standard_groups: list[ListRubricApiStandardGroup] = [
            ListRubricApiStandardGroup(
                standard_group_id=sg.standard_group_id,
                rubric_id=sg.rubric_id,
                name=sg.name,
                description=sg.description,
                points=sg.points,
                pass_points=sg.pass_points,
            )
            for sg in (result.standard_groups or [])
        ]

        standards: list[ListRubricApiStandard] = [
            ListRubricApiStandard(
                standard_id=s.standard_id,
                standard_group_id=s.standard_group_id,
                name=s.name,
                description=s.description,
                points=s.points,
            )
            for s in (result.standards or [])
        ]

        # --- Python hydration: filter option names from cached *_internal() ---
        # Extract option IDs and counts from SQL result
        department_option_ids = getattr(result, "department_option_ids", None) or []
        simulation_option_ids = getattr(result, "simulation_option_ids", None) or []

        # Build ID -> count maps
        department_count_map: dict[UUID, int] = {}
        department_ids_to_fetch: list[UUID] = []
        for opt in department_option_ids:
            opt_id = getattr(opt, "id", None)
            opt_count = getattr(opt, "count", 0)
            if opt_id:
                uid = UUID(str(opt_id)) if not isinstance(opt_id, UUID) else opt_id
                department_count_map[uid] = int(opt_count or 0)
                department_ids_to_fetch.append(uid)

        simulation_count_map: dict[UUID, int] = {}
        simulation_ids_to_fetch: list[UUID] = []
        for opt in simulation_option_ids:
            opt_id = getattr(opt, "id", None)
            opt_count = getattr(opt, "count", 0)
            if opt_id:
                uid = UUID(str(opt_id)) if not isinstance(opt_id, UUID) else opt_id
                simulation_count_map[uid] = int(opt_count or 0)
                simulation_ids_to_fetch.append(uid)

        # Parallel fetch names from cached *_internal() functions
        departments_data = []
        simulations_data = []

        pool = get_pool()
        has_ids = any([department_ids_to_fetch, simulation_ids_to_fetch])

        if pool and has_ids:

            async def fetch_departments() -> list:
                if not department_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_departments_internal(
                        c, department_ids_to_fetch, bypass_cache
                    )

            async def fetch_simulations() -> list:
                if not simulation_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_simulations_internal(
                        c, simulation_ids_to_fetch, bypass_cache
                    )

            departments_data, simulations_data = await asyncio.gather(
                fetch_departments(), fetch_simulations()
            )

        # Merge names with counts, apply search filtering in Python
        department_search = request.department_search
        departments: list[ListRubricApiDepartment] = [
            ListRubricApiDepartment(
                department_id=d.department_id,
                name=d.name,
                description=d.description or "",
                count=department_count_map.get(d.department_id, 0)
                if d.department_id
                else 0,
            )
            for d in departments_data
            if d.department_id
            and (
                department_search is None
                or department_search.lower() in (d.name or "").lower()
            )
        ]

        simulation_search = request.simulation_search
        simulation_options: list[ListRubricApiSimulationOption] = [
            ListRubricApiSimulationOption(
                simulation_id=s.simulation_id,
                name=s.name,
                description=s.description or "",
                count=simulation_count_map.get(s.simulation_id, 0)
                if s.simulation_id
                else 0,
            )
            for s in simulations_data
            if s.simulation_id
            and (
                simulation_search is None
                or simulation_search.lower() in (s.name or "").lower()
            )
        ]

        # Build API response with computed permissions
        api_response = ListRubricApiResponse(
            actor_name=actor_name,
            rubrics=rubrics_with_permissions,
            standard_groups=standard_groups,
            standards=standards,
            departments=departments,
            simulation_options=simulation_options,
            total_count=result.total_count,
        )

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_rubric_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
