"""Agent new endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.types.registry import load_sql_typed
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/agents/get_agent_new_complete.sql"
_sql_query, GetAgentNewSqlParams, GetAgentNewSqlRow = load_sql_typed(SQL_PATH)


router = APIRouter()


@router.post(
    "/new",
    response_model=GetAgentNewSqlRow,
    dependencies=[
        audit_activity("agent.new", "{{ actor.name }} opened new agent form")
    ],
)
async def get_agent_new(
    request: GetAgentNewSqlParams,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAgentNewSqlRow:
    """Get default agent detail metadata for creating new agents."""
    tags = ["agents"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetAgentNewSqlRow.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        # Always override profile_id from request body with header value
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Create params from request, but override profile_id with header value
        params = GetAgentNewSqlParams(**request.model_dump(exclude={"profile_id"}), profile_id=profile_id)
        sql_query = _sql_query
        sql_params = params.to_tuple()
        
        result = await execute_sql_typed(
            conn,
            SQL_PATH,
            params=params,
            list_prefixes={"model_mapping", "department_mapping"},
        )

        # Set audit context if actor_name is available
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": result.model_dump()},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        # Return typed SQL result directly
        return result
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_agent_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
