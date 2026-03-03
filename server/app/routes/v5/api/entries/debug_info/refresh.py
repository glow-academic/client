"""Refresh for debug_info materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.debug_info.refresh import refresh_debug_info_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post("/debug_info/refresh")
async def refresh_debug_info(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the debug_info_mv materialized view."""
    try:
        result = await refresh_debug_info_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,debug_info"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_debug_info",
            request=http_request,
        )
