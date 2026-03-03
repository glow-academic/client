"""Activity refresh endpoint - POST /activity/refresh.

Uses api_refresh_sessions_v4 SQL function to refresh all session MVs in dependency order.
"""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.routes.auth.profile import get_auth_profile_internal
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db, get_pool
from app.sql.types import (
    RefreshMvSessionsApiRequest,
    RefreshMvSessionsApiResponse,
    RefreshMvSessionsSqlParams,
    RefreshMvSessionsSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/analytics/refresh_mv_sessions_complete.sql"

router = APIRouter()


@router.post("/refresh", response_model=RefreshMvSessionsApiResponse)
async def activity_refresh(
    request: RefreshMvSessionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RefreshMvSessionsApiResponse:
    """Refresh all activity section materialized views."""
    tags = ["artifacts", "activity", "session", "list"]

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
        params = RefreshMvSessionsSqlParams(**request_dict, profile_id=profile_id)  # type: ignore[arg-type]
        sql_params = params.to_tuple()

        result = cast(
            RefreshMvSessionsSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        api_response = RefreshMvSessionsApiResponse.model_validate(result.model_dump())

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
            operation="activity_refresh",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
