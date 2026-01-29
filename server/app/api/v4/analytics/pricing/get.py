"""Pricing analytics endpoint - POST /pricing/analytics"""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetPricingAnalyticsApiRequest,
    GetPricingAnalyticsApiResponse,
    GetPricingAnalyticsSqlParams,
    GetPricingAnalyticsSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/pricing/get_pricing_analytics_complete.sql"

router = APIRouter()


@router.post(
    "/get",
    response_model=GetPricingAnalyticsApiResponse,
    dependencies=[
        audit_activity("pricing.get", "{{ actor.name }} viewed pricing analytics")
    ],
)
async def get_pricing(
    request: GetPricingAnalyticsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPricingAnalyticsApiResponse:
    """Get pricing metrics with model usage and cost analysis."""
    tags = ["pricing"]  # From router tags

    # Generate cache key from path and parsed body
    # Use mode='json' to serialize datetime/UUIDs to strings for JSON compatibility
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetPricingAnalyticsApiResponse.model_validate(cached["data"])

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
        params = GetPricingAnalyticsSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Disable JIT and increase work_mem for this complex query to avoid
        # disk-spilling sorts on the 100K+ run pricing aggregations
        async with conn.transaction():
            await conn.execute("SET LOCAL jit = off;")
            await conn.execute("SET LOCAL work_mem = '32MB';")
            result = cast(
                GetPricingAnalyticsSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Convert SQL result to API response (no manual filtering needed - SQL handles it)
        api_response = GetPricingAnalyticsApiResponse.model_validate(
            result.model_dump()
        )

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
            operation="get_pricing",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
