"""Refresh for home_training materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.home_training.refresh import (
    refresh_home_training_internal,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post("/home_training/refresh")
async def refresh_home_training(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the home_training_mv materialized view."""
    try:
        result = await refresh_home_training_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,home_training"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_home_training",
            request=http_request,
        )
