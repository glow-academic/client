"""Benchmark refresh endpoint - POST /benchmark/refresh.

Uses api_refresh_benchmark_v4 SQL function to refresh all benchmark MVs in dependency order.
"""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.api.auth.profile import get_auth_profile_internal
from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db, get_pool
from app.v5.sql.types import (
    RefreshMvBenchmarkApiRequest,
    RefreshMvBenchmarkApiResponse,
    RefreshMvBenchmarkSqlParams,
    RefreshMvBenchmarkSqlRow,
)
from app.v5.utils.cache.invalidate_tags import invalidate_tags
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/analytics/refresh_mv_benchmark_complete.sql"

router = APIRouter()


@router.post("/refresh", response_model=RefreshMvBenchmarkApiResponse)
async def benchmark_refresh(
    request: RefreshMvBenchmarkApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RefreshMvBenchmarkApiResponse:
    """Refresh all benchmark section materialized views."""
    tags = ["artifacts", "benchmark", "test"]

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
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
        else:
            actor_name = None

        request_dict = request.model_dump(mode="json")
        params = RefreshMvBenchmarkSqlParams(**request_dict, profile_id=profile_id)  # type: ignore[arg-type]
        sql_params = params.to_tuple()

        result = cast(
            RefreshMvBenchmarkSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        api_response = RefreshMvBenchmarkApiResponse.model_validate(result.model_dump())

        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="benchmark_refresh",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
