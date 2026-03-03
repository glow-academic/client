"""Refresh for uploads_completions materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.uploads_completions.refresh import (
    refresh_uploads_completions_internal,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post("/uploads_completions/refresh")
async def refresh_uploads_completions(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the uploads_completions_mv materialized view."""
    try:
        result = await refresh_uploads_completions_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,uploads_completions"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_uploads_completions",
            request=http_request,
        )
