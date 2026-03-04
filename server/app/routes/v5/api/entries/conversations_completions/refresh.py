"""Refresh for conversations_completions materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.conversations_completions.refresh import (
    refresh_conversations_completions_internal,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/conversations_completions/refresh")
async def refresh_conversations_completions(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the conversations_completions_mv materialized view."""
    try:
        result = await refresh_conversations_completions_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,conversations_completions"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_conversations_completions",
            request=http_request,
        )
