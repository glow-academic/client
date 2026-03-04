"""Refresh for sessions materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.sessions.refresh import refresh_sessions
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post("/sessions/refresh")
async def refresh_sessions_endpoint(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the sessions_mv materialized view."""
    try:
        await refresh_sessions(conn)
        return {"success": True}
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_sessions",
            request=http_request,
        )
