"""Rubric list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with department_ids, simulation_ids, and counts
2. Python computes permissions (can_edit, can_delete, can_duplicate)

Filter option names hydrated from cached *_internal() functions.
Search filtering applied in Python for option names.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.rubric.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.api.v4.artifacts.rubric.types import (
    ListRubricApiResponse,
    ListRubricApiRubric,
    ListRubricApiStandard,
    ListRubricApiStandardGroup,
)
from app.api.v4.auth.profile import get_auth_profile_internal
from app.api.v4.types import ListFilterSection
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


@router.post("/list", response_model=ListRubricApiResponse)
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
                active_simulation_count=rubric.active_simulation_count or 0,
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

        # Build API response with ListFilterSection pattern (names resolved in SQL)
        api_response = ListRubricApiResponse(
            actor_name=actor_name,
            rubrics=rubrics_with_permissions,
            standard_groups=standard_groups,
            standards=standards,
            department_filter=ListFilterSection.from_sql_options(
                getattr(result, "department_options", None),
                getattr(request, "filter_department_ids", None),
                getattr(request, "department_search", None),
            ),
            simulation_filter=ListFilterSection.from_sql_options(
                getattr(result, "simulation_options", None),
                getattr(request, "filter_simulation_ids", None),
                getattr(request, "simulation_search", None),
            ),
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
