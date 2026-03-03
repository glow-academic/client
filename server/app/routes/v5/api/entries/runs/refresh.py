"""Refresh for runs materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.runs.refresh import refresh_runs_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post("/runs/refresh")
async def refresh_runs(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the runs_mv materialized view."""
    try:
        result = await refresh_runs_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,runs"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_runs",
            request=http_request,
        )
