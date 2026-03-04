"""Refresh for attempt_chat materialized view."""

import time
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt_chat.refresh import refresh_attempt_chat
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/attempt_chat/refresh")
async def refresh_attempt_chat_route(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the attempt_chat_mv materialized view."""
    try:
        start_time = time.time()
        await refresh_attempt_chat(conn)
        duration_ms = int((time.time() - start_time) * 1000)
        response.headers["X-Cache-Tags"] = "entries,attempt_chat"
        return {
            "success": True,
            "duration_ms": duration_ms,
            "message": f"Refreshed attempt_chat_mv in {duration_ms}ms",
        }
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_attempt_chat",
            request=http_request,
        )
