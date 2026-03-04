"""Refresh for problems materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.problems.refresh import refresh_problems_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/problems/refresh")
async def refresh_problems(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the problems_mv materialized view."""
    try:
        result = await refresh_problems_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,problems"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_problems",
            request=http_request,
        )
