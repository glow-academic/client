"""Refresh for resolves materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.resolves.refresh import refresh_resolves as refresh_resolves_impl
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/resolves/refresh")
async def refresh_resolves(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the resolves_mv materialized view."""
    try:
        result = await refresh_resolves_impl(conn)
        response.headers["X-Cache-Tags"] = "entries,resolves"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_resolves",
            request=http_request,
        )
