"""Refresh for emulations materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.emulations.refresh import refresh_emulations_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post("/emulations/refresh")
async def refresh_emulations(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the emulations_mv materialized view."""
    try:
        result = await refresh_emulations_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,emulations"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_emulations",
            request=http_request,
        )
