"""Leaderboard refresh endpoint - POST /leaderboard/refresh.

Uses api_refresh_dashboard_v4 SQL function to refresh all analytics MVs in dependency order.
"""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
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


@router.post(
    "/refresh",
    response_model=RefreshMvDashboardApiResponse,
    dependencies=[
        audit_activity(
            "leaderboard.refresh", "{{ actor.name }} refreshed leaderboard MVs"
        )
    ],
)
async def leaderboard_refresh(
    request: RefreshMvDashboardApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RefreshMvDashboardApiResponse:
    """Refresh all leaderboard section materialized views."""
    tags = ["artifacts", "leaderboard", "views", "analytics"]

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        request_dict = request.model_dump(mode="json")
        params = RefreshMvDashboardSqlParams(**request_dict, profile_id=profile_id)  # type: ignore[arg-type]
        sql_params = params.to_tuple()

        result = cast(
            RefreshMvDashboardSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

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
            operation="leaderboard_refresh",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
