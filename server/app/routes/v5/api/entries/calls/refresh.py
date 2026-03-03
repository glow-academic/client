"""Refresh for calls materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.calls.refresh import refresh_calls_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post("/calls/refresh")
async def refresh_calls(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the calls_mv materialized view."""
    try:
        result = await refresh_calls_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,calls"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_calls",
            request=http_request,
        )
