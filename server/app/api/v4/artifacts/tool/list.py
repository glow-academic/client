"""Tools list endpoint - v4 API following DHH principles.

Two-pass architecture:
1. SQL returns raw data with active_usage_count and total_usage_count
2. Python computes permissions (can_edit, can_delete, can_duplicate)
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.artifacts.tool.permissions import (
    compute_can_delete,
    compute_can_duplicate,
    compute_can_edit,
)
from app.api.v4.artifacts.tool.types import (
    ListToolApiResponse,
    ListToolApiTool,
)
from app.api.v4.auth.context import get_profile_context_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
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
SQL_PATH = "app/sql/v4/queries/tools/get_tools_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=ListToolApiResponse,
    dependencies=[
        audit_activity("tools.list", "{{ actor.name }} visited the Tools page")
    ],
)
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

        # Fetch user context for audit logging and permissions
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                resolved_context = await get_profile_context_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    department_id_cookie=None,
                    bypass_cache=bypass_cache,
                )
                actor_name = resolved_context.actor_name
                user_role = resolved_context.user_role
        else:
            actor_name = None
            user_role = None

        # Convert API request to SQL params (add profile_id from header)
        params = GetToolsListSqlParams(
            profile_id=profile_id,
            search=request.search,
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

        # Set audit context
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
            )

        # user_role already fetched from context above

        # Compute permissions for each tool in Python
        tools_with_permissions: list[ListToolApiTool] = []
        for tool in result.tools or []:
            # Compute permissions based on user role and tool state
            can_edit_val = compute_can_edit(
                user_role=user_role,
                active_usage_count=tool.active_usage_count or 0,
            )
            can_delete_val = compute_can_delete(
                user_role=user_role,
                usage_count=tool.total_usage_count or 0,
            )
            can_duplicate_val = compute_can_duplicate(user_role)

            # Create tool with computed permissions
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

        # Build API response with computed permissions
        api_response = ListToolApiResponse(
            actor_name=actor_name,
            tools=tools_with_permissions,
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
