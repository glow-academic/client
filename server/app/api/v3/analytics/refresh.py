"""Analytics refresh v3 API endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql

router = APIRouter()


class RefreshRequest(BaseModel):
    """Request to refresh analytics (no parameters needed)."""

    pass


class RefreshResponse(BaseModel):
    """Materialized view refresh response."""

    success: bool
    message: str
    status: str


@router.post("/refresh", response_model=RefreshResponse)
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
        sql_query = load_sql("sql/v3/analytics/refresh_materialized_view.sql")
        sql_params = ()  # No parameters for this query
        await conn.execute(sql_query)

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
