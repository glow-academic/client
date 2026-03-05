"""Refresh for attempt_improvement materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt_improvement.refresh import (
    refresh_attempt_improvement as refresh_attempt_improvement_impl,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/attempt_improvement/refresh")
async def refresh_attempt_improvement(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the attempt_improvement_mv materialized view."""
    try:
        result = await refresh_attempt_improvement_impl(conn)
        response.headers["X-Cache-Tags"] = "entries,attempt_improvement"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_attempt_improvement",
            request=http_request,
        )
