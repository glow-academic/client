"""Tools list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with active_usage_count and total_usage_count
2. Python computes permissions (can_edit, can_delete, can_duplicate)

Filter option names resolved in SQL via ListFilterSection pattern.
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.tool.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.v5.api.main.tool.types import (
    ListToolApiResponse,
    ListToolApiTool,
)
from app.v5.api.auth.profile import get_auth_profile_internal
from app.v5.api.types import ListFilterSection
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import (
    GetToolsListApiRequest,
    GetToolsListSqlParams,
    GetToolsListSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/queries/tools/get_tools_list_complete.sql"

router = APIRouter()


@router.post("/list", response_model=ListToolApiResponse)
async def get_tool_list(
    request: GetToolsListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ListToolApiResponse:
    """Get tools list with permissions."""
    tags = ["tools"]

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
            return ListToolApiResponse.model_validate(cached["data"])

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

        # Convert API request to SQL params (add profile_id from header)
        params = GetToolsListSqlParams(
            profile_id=profile_id,
            search=request.search,
            filter_department_ids=getattr(request, "filter_department_ids", None),
            filter_agent_ids=getattr(request, "filter_agent_ids", None),
            filter_creatable=getattr(request, "filter_creatable", None),
            department_search=getattr(request, "department_search", None),
            agent_search=getattr(request, "agent_search", None),
            page_size=request.page_size,
            page_offset=request.page_offset,
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            GetToolsListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Compute permissions for each tool in Python
        tools_with_permissions: list[ListToolApiTool] = []
        for tool in result.tools or []:
            can_edit_val = compute_can_edit(
                user_role=user_role,
                active_agent_count=tool.active_agent_count or 0,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                active_agent_count=tool.active_agent_count or 0,
            )
            can_duplicate_val = compute_can_duplicate(user_role)

            tools_with_permissions.append(
                ListToolApiTool(
                    tool_id=tool.tool_id,
                    name=tool.name,
                    description=tool.description,
                    active=tool.active,
                    updated_at=tool.updated_at,
                    can_edit=can_edit_val,
                    can_duplicate=can_duplicate_val,
                    can_delete=can_delete_val,
                )
            )

        # Build API response with ListFilterSection pattern
        api_response = ListToolApiResponse(
            actor_name=actor_name,
            tools=tools_with_permissions,
            department_filter=ListFilterSection.from_sql_options(
                result.department_options,
                getattr(request, "filter_department_ids", None),
                getattr(request, "department_search", None),
            ),
            agent_filter=ListFilterSection.from_sql_options(
                result.agent_options,
                getattr(request, "filter_agent_ids", None),
                getattr(request, "agent_search", None),
            ),
            creatable_filter=ListFilterSection.from_sql_options(
                result.creatable_options,
                getattr(request, "filter_creatable", None),
                None,
            ),
            total_count=result.total_count,
        )

        # Cache response
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
            operation="get_tool_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
