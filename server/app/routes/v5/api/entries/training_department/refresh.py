"""Refresh for training_department materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.training_department.refresh import (
    refresh_training_department_internal,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/training_department/refresh")
async def refresh_training_department(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the training_department_mv materialized view."""
    try:
        result = await refresh_training_department_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,training_department"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_training_department",
            request=http_request,
        )
