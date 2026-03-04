"""Refresh for field_drafts materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.field_drafts.refresh import (
    refresh_field_drafts_internal,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/field_drafts/refresh")
async def refresh_field_drafts(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the field_drafts_mv materialized view."""
    try:
        result = await refresh_field_drafts_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,field_drafts"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_field_drafts",
            request=http_request,
        )
