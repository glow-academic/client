"""Reports bundle v4 API endpoint."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.api.v4.export.report import router as export_router
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetReportsBundleApiRequest,
                           GetReportsBundleApiResponse,
                           GetReportsBundleSqlParams, GetReportsBundleSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/reports/get_reports_bundle_complete.sql"

router = APIRouter(prefix="/reports", tags=["reports"])
router.include_router(export_router)


@router.post(
    "",
    response_model=GetReportsBundleApiResponse,
    dependencies=[
        audit_activity("reports.bundle", "{{ actor.name }} viewed reports bundle")
    ],
)
async def get_reports(
    request: GetReportsBundleApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetReportsBundleApiResponse:
    """Get reports bundle with aggregated metrics per profile and entity mappings."""
    tags = ["reports"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body (use mode='json' for consistent serialization)
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetReportsBundleApiResponse.model_validate(cached["data"])

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
        # Note: request fields are snake_case (start_date, end_date, etc.)
        # SQL handles date conversion from text to timestamptz - no manual parsing needed
        params = GetReportsBundleSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Disable JIT compilation for this complex query to avoid re-compilation overhead
        async with conn.transaction():
            await conn.execute("SET LOCAL jit = off;")
            # Execute query with typed helper - automatically detects and calls function if present
            result = cast(
                GetReportsBundleSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

        # Set audit context using actor_name from SQL result
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Convert SQL result to API response
        # Note: SQL returns arrays (scenarios[], simulations[]) instead of mappings
        # Auto-generated types handle the conversion
        api_response = GetReportsBundleApiResponse.model_validate(result.model_dump())

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
            operation="get_reports",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
