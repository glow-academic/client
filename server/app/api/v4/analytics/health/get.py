"""Health bundle endpoint - POST /health/bundle"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetHealthApiRequest, GetHealthApiResponse,
                           GetHealthSqlParams, GetHealthSqlRow, load_sql_query)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed
from fastapi import APIRouter, Depends, HTTPException, Request, Response

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/health/get_health_complete.sql"

router = APIRouter()


@router.post(
    "/get",
    response_model=GetHealthApiResponse,
    dependencies=[audit_activity("health.get", "{{ actor.name }} viewed health")],
)
async def get_health(
    request: GetHealthApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetHealthApiResponse:
    """Get health bundle with health KPIs and metrics."""
    tags = ["health"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetHealthApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id

        # Convert API request to SQL params (add profile_id from header)
        # Use double star pattern for parameter construction
        import uuid

        profile_id_uuid = uuid.UUID(profile_id) if profile_id else None
        params = GetHealthSqlParams(
            **request.model_dump(), profile_id=profile_id_uuid
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            GetHealthSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context using actor_name from SQL result
        if result.actor_name and profile_id:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Build response - SQL function returns structured data
        api_response = GetHealthApiResponse.model_validate(result.model_dump())

        # Cache response (use mode='json' to serialize UUIDs for JSON caching)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=60,  # Cache for 1 minute (health data changes frequently)
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
            operation="get_health",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
