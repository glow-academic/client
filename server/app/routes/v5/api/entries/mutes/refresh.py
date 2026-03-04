"""Refresh for mutes materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.mutes.refresh import refresh_mutes_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/mutes/refresh")
async def refresh_mutes(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the mutes_mv materialized view."""
    try:
        result = await refresh_mutes_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,mutes"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_mutes",
            request=http_request,
        )
