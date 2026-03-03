"""Refresh for setting_drafts materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.setting_drafts.refresh import (
    refresh_setting_drafts_internal,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post("/setting_drafts/refresh")
async def refresh_setting_drafts(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the setting_drafts_mv materialized view."""
    try:
        result = await refresh_setting_drafts_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,setting_drafts"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_setting_drafts",
            request=http_request,
        )
