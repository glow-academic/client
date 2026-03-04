"""Refresh for reports materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.reports.refresh import refresh_reports_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/reports/refresh")
async def refresh_reports(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the reports_mv materialized view."""
    try:
        result = await refresh_reports_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,reports"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_reports",
            request=http_request,
        )
