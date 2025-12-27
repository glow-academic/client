"""Auth detail endpoint."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetAuthDetailApiRequest,
    GetAuthDetailApiResponse,
    GetAuthDetailSqlParams,
    GetAuthDetailSqlRow,
)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/auth/get_auth_detail_complete.sql"

router = APIRouter()


@router.post(
    "/detail",
    response_model=GetAuthDetailApiResponse,
    dependencies=[
        audit_activity("auth.viewed", "{{ actor.name }} viewed auth '{{ auth.name }}'")
    ],
)
async def get_auth_detail(
    request: GetAuthDetailApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAuthDetailApiResponse:
    """Get detailed auth information with nested items and keys."""
    tags = ["auth"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode='json')
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetAuthDetailApiResponse.model_validate(cached["data"])

    sql_query: str | None = None
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
        params = GetAuthDetailSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute SQL with typed helper (single row result)
        result = cast(
            GetAuthDetailSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if auth exists and has access using SQL result
        # SQL now returns auth_exists field to distinguish 404 vs 403
        if not result.auth_exists:
            raise HTTPException(
                status_code=404, detail=f"Auth {request.auth_id} not found"
            )
        
        if not result.name:
            # Auth exists but user doesn't have access
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this auth entry. It may be restricted to other departments.",
            )

        # Set audit context with data from SQL query
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                auth={"name": result.name, "id": str(request.auth_id)},
            )

        # Convert SQL result to API response
        response_data = GetAuthDetailApiResponse.model_validate(result.model_dump())

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump(mode='json')},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_auth_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
