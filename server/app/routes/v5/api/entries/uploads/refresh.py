"""Refresh for uploads materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.uploads.refresh import refresh_uploads_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/uploads/refresh")
async def refresh_uploads(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the uploads_mv materialized view."""
    try:
        result = await refresh_uploads_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,uploads"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_uploads",
            request=http_request,
        )
