"""Simulation Drafts entry SEARCH endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.simulation_drafts.search import search_simulation_drafts
from app.sql.types import (
    SearchSimulationDraftsEntriesApiRequest,
    SearchSimulationDraftsEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/simulation_drafts/search",
    response_model=SearchSimulationDraftsEntriesApiResponse,
)
async def search_simulation_drafts_entries(
    request: SearchSimulationDraftsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchSimulationDraftsEntriesApiResponse:
    """Search simulation_drafts entries."""
    tags = ["entries", "simulation_drafts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_simulation_drafts(
            conn,
            limit=request.limit_count,
            offset=request.offset_count,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchSimulationDraftsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_simulation_drafts_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
