"""Refresh for logins materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.logins.refresh import refresh_logins_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/logins/refresh")
async def refresh_logins(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the logins_mv materialized view."""
    try:
        result = await refresh_logins_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,logins"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_logins",
            request=http_request,
        )
