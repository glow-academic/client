"""Agent detail endpoint."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetAgentDetailApiRequest, GetAgentDetailApiResponse,
                           GetAgentDetailSqlParams, GetAgentDetailSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/agents/get_agent_detail_complete.sql"



router = APIRouter()


@router.post(
    "/detail",
    response_model=GetAgentDetailApiResponse,
    dependencies=[
        audit_activity(
            "agent.viewed", "{{ actor.name }} viewed agent '{{ agent.name }}'"
        )
    ],
)
async def get_agent_detail(
    request: GetAgentDetailApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAgentDetailApiResponse:
    """Get agent detail with debug info and metadata."""
    tags = ["agents"]  # From router tags

    # Generate cache key from path and parsed body
    # Use mode='json' to serialize UUIDs to strings for JSON compatibility
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetAgentDetailApiResponse.model_validate(cached["data"])

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

        # Convert API request to SQL params (add profile_id from header)
        params = GetAgentDetailSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute SQL with typed helper (single row result)
        # Prefixes auto-detected from SQL column names
        result = cast(
            GetAgentDetailSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if result is empty (no access or not found)
        # SQL handles access control via WHERE clause, so empty result means no access or not found
        if not result.agent_id:
            # Check if agent exists but user doesn't have department access
            agent_exists_check = await conn.fetchval(
                "SELECT EXISTS(SELECT 1 FROM agents WHERE id = $1)",
                request.agent_id,
            )
            if agent_exists_check:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this agent. It may be restricted to other departments.",
                )
            raise HTTPException(
                status_code=404, detail=f"Agent {request.agent_id} not found"
            )

        # Set audit context with data from SQL query
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                agent={"name": result.name, "id": str(request.agent_id)},
            )

        # Convert SQL result to API response
        response_data = GetAgentDetailApiResponse.model_validate(result.model_dump())

        # Cache response (model_mapping now includes all fields via ModelMappingItem)
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        # Return response (model_mapping already includes modalities and options via ModelMappingItem)
        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_agent_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
