"""Attempt full endpoint - returns complete attempt data with all related entities."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetSimulationAttemptApiRequest,
    GetSimulationAttemptApiResponse,
    GetSimulationAttemptSqlParams,
    GetSimulationAttemptSqlRow,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/attempts/get_simulation_attempt_complete.sql"


router = APIRouter()


@router.post(
    "/simulation",
    response_model=GetSimulationAttemptApiResponse,
    dependencies=[
        audit_activity(
            "attempt.viewed", "{{ actor.name }} viewed attempt '{{ attempt.id }}'"
        )
    ],
)
async def get_attempt_full(
    request: GetSimulationAttemptApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSimulationAttemptApiResponse:
    """Get complete attempt data with all related entities and computed values."""
    tags = ["attempts"]  # From router tags

    # Check for cache bypass header (for hard refresh)
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
            return GetSimulationAttemptApiResponse.model_validate(cached["data"])

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
        params = GetSimulationAttemptSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper (single row result)
        result = cast(
            GetSimulationAttemptSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if attempt exists using SQL result
        if not result.attempt_exists:
            raise HTTPException(
                status_code=404, detail=f"Attempt not found: {request.attempt_id}"
            )

        # Check role-based access control (handled in SQL)
        if result.access_denied:
            raise HTTPException(
                status_code=403,
                detail="You don't have permission to view this attempt. Your role is lower than the attempt owner's role.",
            )

        # Set audit context
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                attempt={"id": str(request.attempt_id)},
            )

        # Convert SQL result to API response
        api_response = GetSimulationAttemptApiResponse.model_validate(
            result.model_dump()
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
            operation="get_attempt_full",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
