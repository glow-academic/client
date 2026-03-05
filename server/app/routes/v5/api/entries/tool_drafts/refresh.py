"""Refresh for tool_drafts materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.tool_drafts.refresh import refresh_tool_drafts as refresh_tool_drafts_impl
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/tool_drafts/refresh")
async def refresh_tool_drafts(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the tool_drafts_mv materialized view."""
    try:
        result = await refresh_tool_drafts_impl(conn)
        response.headers["X-Cache-Tags"] = "entries,tool_drafts"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_tool_drafts",
            request=http_request,
        )
