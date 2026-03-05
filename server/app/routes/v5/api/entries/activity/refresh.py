"""Refresh for activity materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.activity.refresh import (
    refresh_activity as refresh_activity_impl,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/activity/refresh")
async def refresh_activity(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the activity_mv materialized view."""
    try:
        result = await refresh_activity_impl(conn)
        response.headers["X-Cache-Tags"] = "entries,activity"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_activity",
            request=http_request,
        )
