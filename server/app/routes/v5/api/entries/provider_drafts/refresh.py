"""Refresh for provider_drafts materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.provider_drafts.refresh import (
    refresh_provider_drafts_internal,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/provider_drafts/refresh")
async def refresh_provider_drafts(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the provider_drafts_mv materialized view."""
    try:
        result = await refresh_provider_drafts_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,provider_drafts"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_provider_drafts",
            request=http_request,
        )
