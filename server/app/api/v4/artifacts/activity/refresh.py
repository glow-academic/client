"""Activity refresh endpoint - POST /activity/refresh.

Uses api_refresh_sessions_v4 SQL function to refresh all session MVs in dependency order.
"""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.auth.context import get_profile_context_internal
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db, get_pool
from app.sql.types import (
    RefreshMvSessionsApiRequest,
    RefreshMvSessionsApiResponse,
    RefreshMvSessionsSqlParams,
    RefreshMvSessionsSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/analytics/refresh_mv_sessions_complete.sql"

router = APIRouter()


@router.post(
    "/refresh",
    response_model=RefreshMvSessionsApiResponse,
    dependencies=[
        audit_activity("activity.refresh", "{{ actor.name }} refreshed activity MVs")
    ],
)
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

        # Fetch user context for audit logging
        pool = get_pool()
        if pool:
            async with pool.acquire() as context_conn:
                resolved_context = await get_profile_context_internal(
                    conn=context_conn,
                    profile_id=profile_id,
                    bypass_cache=False,
                )
                actor_name = resolved_context.actor_name
        else:
            actor_name = None

        request_dict = request.model_dump(mode="json")
        params = RefreshMvSessionsSqlParams(**request_dict, profile_id=profile_id)  # type: ignore[arg-type]
        sql_params = params.to_tuple()

        result = cast(
            RefreshMvSessionsSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

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
