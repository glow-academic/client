"""Agent delete endpoint."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.main.agent.permissions import compute_can_delete
from app.v5.api.auth.profile import get_auth_profile_internal
from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.v5.sql.types import (
    DeleteAgentApiRequest,
    DeleteAgentApiResponse,
    DeleteAgentSqlParams,
    DeleteAgentSqlRow,
    load_sql_query,
)
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/v5/sql/queries/agents/delete_agent_complete.sql"

router = APIRouter()


@router.post("/delete", response_model=DeleteAgentApiResponse)
async def delete_agent(
    request: DeleteAgentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> DeleteAgentApiResponse:
    """Delete an agent."""
    tags = ["agents"]  # From router tags

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
                    bypass_cache=False,
                )
                actor_name = profile_ctx.access.actor_name
                user_role = profile_ctx.access.role
        else:
            actor_name = None
            user_role = None

        # Convert API request to SQL params (add profile_id from header)
        params = DeleteAgentSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = cast(
            DeleteAgentSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        can_delete = compute_can_delete(
            user_role=user_role,
            active_settings_count=result.usage_count or 0,
        )

        if not can_delete:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to delete this agent.",
            )

        # Convert SQL result to API response
        # Note: API response matches SQL response structure (usage_count, deleted, name, actor_name)
        api_response = DeleteAgentApiResponse.model_validate(result.model_dump())

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="delete_agent",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
