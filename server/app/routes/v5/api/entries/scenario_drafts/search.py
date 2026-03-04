"""Scenario Drafts entry SEARCH endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.scenario_drafts.search import (
    SQL_PATH,
    search_scenario_drafts_entries_internal,
)
from app.sql.types import (
    SearchScenarioDraftsEntriesApiRequest,
    SearchScenarioDraftsEntriesApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/scenario_drafts/search",
    response_model=SearchScenarioDraftsEntriesApiResponse,
)
async def search_scenario_drafts_entries(
    request: SearchScenarioDraftsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchScenarioDraftsEntriesApiResponse:
    """Search scenario_drafts entries."""
    tags = ["entries", "scenario_drafts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_scenario_drafts_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchScenarioDraftsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_scenario_drafts_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
