"""Parameters list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with active_scenario_count and total_scenario_links
2. Python computes permissions (can_edit, can_delete, can_duplicate)

Filter option names hydrated from cached *_internal() functions.
Search filtering applied in Python.
"""

import asyncio
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.parameter.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.api.v4.artifacts.parameter.types import (
    ListParameterApiDepartment,
    ListParameterApiParameter,
    ListParameterApiResponse,
    ListParameterApiScenario,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.resources.departments.get import get_departments_internal
from app.api.v4.resources.scenarios.get import get_scenarios_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    GetParametersListApiRequest,
    GetParametersListSqlParams,
    GetParametersListSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/parameters/get_parameters_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=ListParameterApiResponse,
    dependencies=[
        audit_activity(
            "parameters.list", "{{ actor.name }} visited the Parameters page"
        )
    ],
)
async def get_parameter_list(
    request: GetParametersListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListParameterApiResponse:
    """Get parameters list with permissions and scenario details."""
    tags = ["parameters"]

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
            return ListParameterApiResponse.model_validate(cached["data"])

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
                user_department_ids = [
                    d.department_id for d in profile_ctx.departments if d.department_id
                ]
        else:
            actor_name = None
            user_role = None
            user_department_ids = []

        # Convert API request to SQL params (add profile_id from header + request body fields)
        params = GetParametersListSqlParams(
            profile_id=profile_id,
            search=request.search,
            scenario_ids=request.scenario_ids,
            filter_department_ids=request.filter_department_ids,
            scenario_search=request.scenario_search,
            department_search=request.department_search,
            page_size=request.page_size,
            page_offset=request.page_offset,
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            GetParametersListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        # user_role already fetched from context above

        # Compute permissions for each parameter in Python
        parameters_with_permissions: list[ListParameterApiParameter] = []
        for parameter in result.parameters or []:
            can_edit_val = compute_can_edit(
                user_role=user_role,
                parameter_department_ids=parameter.department_ids,
                active_scenario_count=parameter.active_scenario_count or 0,
                user_department_ids=user_department_ids,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                parameter_department_ids=parameter.department_ids,
                active_scenario_count=parameter.active_scenario_count or 0,
            )
            can_duplicate_val = compute_can_duplicate(user_role)

            # Create parameter with computed permissions
            parameters_with_permissions.append(
                ListParameterApiParameter(
                    parameter_id=parameter.parameter_id,
                    name=parameter.name,
                    description=parameter.description,
                    active=parameter.active,
                    department_ids=parameter.department_ids,
                    scenario_ids=parameter.scenario_ids,
                    num_items=parameter.num_items,
                    sample_items=[
                        item.name
                        for item in (parameter.sample_items or [])
                        if item.name
                    ],
                    can_edit=can_edit_val,
                    can_duplicate=can_duplicate_val,
                    can_delete=can_delete_val,
                    updated_at=parameter.updated_at,
                )
            )

        # --- Python hydration: filter option names from cached *_internal() ---
        # Extract option IDs and counts from SQL result
        scenario_option_ids = getattr(result, "scenario_option_ids", None) or []
        department_option_ids = getattr(result, "department_option_ids", None) or []

        # Build ID -> count maps
        scenario_count_map: dict[UUID, int] = {}
        scenario_ids_to_fetch: list[UUID] = []
        for opt in scenario_option_ids:
            opt_id = getattr(opt, "id", None)
            opt_count = getattr(opt, "count", 0)
            if opt_id:
                uid = UUID(str(opt_id)) if not isinstance(opt_id, UUID) else opt_id
                scenario_count_map[uid] = int(opt_count or 0)
                scenario_ids_to_fetch.append(uid)

        department_count_map: dict[UUID, int] = {}
        department_ids_to_fetch: list[UUID] = []
        for opt in department_option_ids:
            opt_id = getattr(opt, "id", None)
            opt_count = getattr(opt, "count", 0)
            if opt_id:
                uid = UUID(str(opt_id)) if not isinstance(opt_id, UUID) else opt_id
                department_count_map[uid] = int(opt_count or 0)
                department_ids_to_fetch.append(uid)

        # Parallel fetch names from cached *_internal() functions
        scenarios_data = []
        departments_data = []

        pool = get_pool()
        has_ids = any([scenario_ids_to_fetch, department_ids_to_fetch])

        if pool and has_ids:

            async def fetch_scenarios() -> list:
                if not scenario_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_scenarios_internal(
                        c, scenario_ids_to_fetch, bypass_cache
                    )

            async def fetch_departments() -> list:
                if not department_ids_to_fetch:
                    return []
                async with pool.acquire() as c:
                    return await get_departments_internal(
                        c, department_ids_to_fetch, bypass_cache
                    )

            scenarios_data, departments_data = await asyncio.gather(
                fetch_scenarios(), fetch_departments()
            )

        # Merge names with counts, apply search filtering in Python
        scenario_search = request.scenario_search
        scenarios: list[ListParameterApiScenario] = [
            ListParameterApiScenario(
                scenario_id=s.scenario_id,
                name=s.name,
                description=s.description or "",
                count=scenario_count_map.get(s.scenario_id, 0) if s.scenario_id else 0,
            )
            for s in scenarios_data
            if s.scenario_id
            and (
                scenario_search is None
                or scenario_search.lower() in (s.name or "").lower()
            )
        ]

        department_search = request.department_search
        departments: list[ListParameterApiDepartment] = [
            ListParameterApiDepartment(
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

        # Build API response with computed permissions
        api_response = ListParameterApiResponse(
            actor_name=actor_name,
            parameters=parameters_with_permissions,
            scenarios=scenarios,
            departments=departments,
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
            operation="get_parameter_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
