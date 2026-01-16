"""Practice overview endpoint - POST /practice/overview"""

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
    GetPracticeOverviewApiRequest,
    GetPracticeOverviewApiResponse,
    GetPracticeOverviewSqlParams,
    GetPracticeOverviewSqlRow,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/practice/get_practice_overview_complete.sql"

router = APIRouter()


@router.post(
    "/overview",
    response_model=GetPracticeOverviewApiResponse,
    dependencies=[
        audit_activity("practice.overview", "{{ actor.name }} viewed practice overview")
    ],
)
async def get_practice_overview(
    request: GetPracticeOverviewApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPracticeOverviewApiResponse:
    """Get practice overview data with items and all entity mappings.

    Practice uses simplified filters: only profileId and departmentIds.
    No cohort/role/date filtering for personal practice.
    Note: History is not included in overview - use /practice/history endpoint separately.
    """
    tags = ["practice"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetPracticeOverviewApiResponse.model_validate(cached["data"])

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

        # Profile ID must be a valid UUID
        # Guest profile IDs are resolved on the client side before calling this endpoint
        profile_id_final = profile_id.strip()
        if not profile_id_final:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params (add profile_id from header)
        # Use double star pattern: **request.model_dump()
        params = GetPracticeOverviewSqlParams(
            **request.model_dump(), profile_id=profile_id_final
        )
        sql_params = params.to_tuple()

        # Disable JIT compilation for this complex query to avoid re-compilation overhead
        async with conn.transaction():
            await conn.execute("SET LOCAL jit = off;")
            # Execute query with typed helper - automatically detects and calls function if present
            result = cast(
                GetPracticeOverviewSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH,
                    params=params,
                ),
            )

        # Set audit context
        if result.actor_name:
            audit_set(
                http_request, actor={"name": result.actor_name, "id": profile_id_final}
            )

        # Convert SQL result to API response (no manual filtering needed - SQL handles it)
        api_response = GetPracticeOverviewApiResponse.model_validate(
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
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_practice_overview",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
