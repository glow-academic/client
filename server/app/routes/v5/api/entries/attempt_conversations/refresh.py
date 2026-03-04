"""Refresh for conversations materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt_conversations.refresh import (
    refresh_conversations_internal,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/attempt_conversations/refresh")
async def refresh_conversations(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the attempt_conversations_mv materialized view."""
    try:
        result = await refresh_conversations_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,attempt_conversations"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_conversations",
            request=http_request,
        )
