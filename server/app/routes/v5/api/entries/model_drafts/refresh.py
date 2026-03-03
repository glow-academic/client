"""Refresh for model_drafts materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.model_drafts.refresh import (
    refresh_model_drafts_internal,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post("/model_drafts/refresh")
async def refresh_model_drafts(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the model_drafts_mv materialized view."""
    try:
        result = await refresh_model_drafts_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,model_drafts"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_model_drafts",
            request=http_request,
        )
