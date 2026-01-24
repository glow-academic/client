"""Dashboard bundle v4 API endpoint."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetDashboardBundleApiRequest,
                           GetDashboardBundleApiResponse,
                           GetDashboardBundleSqlParams,
                           GetDashboardBundleSqlRow, load_sql_query)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed
from fastapi import APIRouter, Depends, HTTPException, Request, Response

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/dashboard/get_dashboard_bundle_complete.sql"


router = APIRouter()


@router.post(
    "/get",
    response_model=GetDashboardBundleApiResponse,
    dependencies=[
        audit_activity("dashboard.get", "{{ actor.name }} viewed dashboard")
    ],
)
async def get_dashboard(
    request: GetDashboardBundleApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetDashboardBundleApiResponse:
    """Get complete dashboard bundle with all metrics, history, insights, and mappings."""
    tags = ["dashboard"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body (use mode='json' for UUID serialization)
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetDashboardBundleApiResponse.model_validate(cached["data"])

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
        # Use double star pattern: **request.model_dump()
        params = GetDashboardBundleSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Disable JIT and nested loops for this complex query - nested loops cause
        # O(n²) re-evaluation of views; hash/merge joins are 60x faster here
        async with conn.transaction():
            await conn.execute("SET LOCAL jit = off;")
            await conn.execute("SET LOCAL enable_nestloop = off;")
            result = cast(
                GetDashboardBundleSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Convert SQL result to API response (no manual parsing needed - SQL handles it)
        api_response = GetDashboardBundleApiResponse.model_validate(result.model_dump())

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=300,
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
            operation="get_dashboard",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
