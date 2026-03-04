"""Refresh for run_pricing materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.run_pricing.refresh import refresh_run_pricing_internal
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/run_pricing/refresh")
async def refresh_run_pricing(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the run_pricing_mv materialized view."""
    try:
        result = await refresh_run_pricing_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,run_pricing"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_run_pricing",
            request=http_request,
        )
