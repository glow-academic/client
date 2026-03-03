"""Refresh for suite_department materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.suite_department.refresh import (
    refresh_suite_department_internal,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post("/suite_department/refresh")
async def refresh_suite_department(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the suite_department_mv materialized view."""
    try:
        result = await refresh_suite_department_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,suite_department"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_suite_department",
            request=http_request,
        )
