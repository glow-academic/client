"""Analytics refresh v3 API endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import load_sql

router = APIRouter()


class RefreshRequest(BaseModel):
    """Request to refresh analytics (no parameters needed)."""

    pass


class RefreshResponse(BaseModel):
    """Materialized view refresh response."""

    success: bool
    message: str
    status: str


@router.post(
    "/refresh",
    response_model=RefreshResponse,
    dependencies=[
        audit_activity("analytics.refreshed", "{{ actor.name }} refreshed analytics")
    ],
)
async def refresh_analytics(
    request: RefreshRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RefreshResponse:
    """Refresh the analytics materialized view."""
    tags = ["analytics"]  # From router tags

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

        sql_query = load_sql("app/sql/v3/analytics/refresh_materialized_view.sql")
        sql_params = ()  # No parameters for this query
        await conn.execute(sql_query)

        # Fetch actor_name separately
        actor_name_row = await conn.fetchrow(
            "SELECT first_name || ' ' || last_name as actor_name FROM profiles WHERE id = $1",
            profile_id,
        )
        actor_name = actor_name_row["actor_name"] if actor_name_row else None

        # Set audit context
        if actor_name:
            audit_set(http_request, actor={"name": actor_name, "id": profile_id})

        result_data = RefreshResponse(
            success=True,
            message="Analytics materialized view refreshed successfully",
            status="success",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_analytics",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
