"""Refresh for scenario_drafts materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.scenario_drafts.refresh import (
    refresh_scenario_drafts as refresh_scenario_drafts_impl,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/scenario_drafts/refresh")
async def refresh_scenario_drafts(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the scenario_drafts_mv materialized view."""
    try:
        result = await refresh_scenario_drafts_impl(conn)
        response.headers["X-Cache-Tags"] = "entries,scenario_drafts"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_scenario_drafts",
            request=http_request,
        )
