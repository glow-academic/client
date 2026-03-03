"""Refresh for responses materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.responses.refresh import refresh_responses_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post("/responses/refresh")
async def refresh_responses(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the responses_mv materialized view."""
    try:
        result = await refresh_responses_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,responses"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_responses",
            request=http_request,
        )
