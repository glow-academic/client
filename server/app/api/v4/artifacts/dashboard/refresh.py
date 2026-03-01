"""Dashboard refresh endpoint - POST /dashboard/refresh.

Uses api_refresh_dashboard_v4 SQL function to refresh all dashboard MVs in dependency order.
"""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.auth.profile import get_auth_profile_internal
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    RefreshMvDashboardApiRequest,
    RefreshMvDashboardApiResponse,
    RefreshMvDashboardSqlParams,
    RefreshMvDashboardSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/analytics/refresh_mv_dashboard_complete.sql"

router = APIRouter()


@router.post("/refresh", response_model=RefreshMvDashboardApiResponse)
async def dashboard_refresh(
    request: RefreshMvDashboardApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RefreshMvDashboardApiResponse:
    """Refresh all dashboard section materialized views."""
    tags = ["artifacts", "dashboard", "views", "analytics", "attempt", "list"]

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
        params = RefreshMvDashboardSqlParams(**request_dict, profile_id=profile_id)  # type: ignore[arg-type]
        sql_params = params.to_tuple()

        result = cast(
            RefreshMvDashboardSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        api_response = RefreshMvDashboardApiResponse.model_validate(result.model_dump())

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
            operation="dashboard_refresh",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
