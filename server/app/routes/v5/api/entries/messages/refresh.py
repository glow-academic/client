"""Refresh for messages materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.messages.refresh import refresh_messages_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post("/messages/refresh")
async def refresh_messages(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the messages_mv materialized view."""
    try:
        result = await refresh_messages_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,messages"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_messages",
            request=http_request,
        )
