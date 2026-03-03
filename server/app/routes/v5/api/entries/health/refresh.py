"""Refresh for health materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.health.refresh import refresh_health_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post("/health/refresh")
async def refresh_health(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the health_mv materialized view."""
    try:
        result = await refresh_health_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,health"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_health",
            request=http_request,
        )
