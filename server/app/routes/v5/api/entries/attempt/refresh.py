"""Refresh for attempt materialized view."""

import time
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt.refresh import refresh_attempt
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/attempt/refresh")
async def refresh_attempt_route(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the attempt_mv materialized view."""
    try:
        start_time = time.time()
        await refresh_attempt(conn)
        duration_ms = int((time.time() - start_time) * 1000)
        response.headers["X-Cache-Tags"] = "entries,attempt"
        return {
            "success": True,
            "duration_ms": duration_ms,
            "message": f"Refreshed attempt_mv in {duration_ms}ms",
        }
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_attempt",
            request=http_request,
        )
