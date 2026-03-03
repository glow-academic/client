"""Refresh for audios materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.audios.refresh import refresh_audios_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post("/audios/refresh")
async def refresh_audios(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the audios_mv materialized view."""
    try:
        result = await refresh_audios_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,audios"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_audios",
            request=http_request,
        )
