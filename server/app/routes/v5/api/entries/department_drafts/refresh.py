"""Refresh for department_drafts materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.department_drafts.refresh import (
    refresh_department_drafts as refresh_department_drafts_impl,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/department_drafts/refresh")
async def refresh_department_drafts(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the department_drafts_mv materialized view."""
    try:
        result = await refresh_department_drafts_impl(conn)
        response.headers["X-Cache-Tags"] = "entries,department_drafts"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_department_drafts",
            request=http_request,
        )
