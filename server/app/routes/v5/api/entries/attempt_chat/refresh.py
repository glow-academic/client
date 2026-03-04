"""Refresh for attempt_chat materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt_chat.refresh import (
    refresh_attempt_chat_internal,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/attempt_chat/refresh")
async def refresh_attempt_chat(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the attempt_chat_mv materialized view."""
    try:
        result = await refresh_attempt_chat_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,attempt_chat"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_attempt_chat",
            request=http_request,
        )
