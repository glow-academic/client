"""Refresh for training materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.training.refresh import refresh_training_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/training/refresh")
async def refresh_training(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the training_mv materialized view."""
    try:
        result = await refresh_training_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,training"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_training",
            request=http_request,
        )
