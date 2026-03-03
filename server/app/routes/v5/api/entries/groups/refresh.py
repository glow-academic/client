"""Refresh for groups materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.groups.refresh import refresh_groups_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post("/groups/refresh")
async def refresh_groups(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the groups_mv materialized view."""
    try:
        result = await refresh_groups_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,groups"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_groups",
            request=http_request,
        )
