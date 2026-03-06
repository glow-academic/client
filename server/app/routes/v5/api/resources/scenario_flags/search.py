"""Scenario flags SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.scenario_flags.search import (
    search_scenario_flags as search_scenario_flags_fn,
)
from app.sql.types import (
    SearchScenarioFlagsApiRequest,
    SearchScenarioFlagsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/scenario_flags/search",
    response_model=SearchScenarioFlagsApiResponse,
)
async def search_scenario_flags(
    request: SearchScenarioFlagsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchScenarioFlagsApiResponse:
    """Search available scenario flags for scenarios."""
    tags = ["resources", "scenario_flags"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_scenario_flags_fn(
            conn,
            get_redis_client(),
            search=request.search,
            limit_count=request.limit_count or 20,
            offset_count=request.offset_count or 0,
            exclude_ids=request.exclude_ids,
            scenario_ids=request.scenario_ids,
            flag_ids=request.flag_ids,
            bypass_cache=bypass_cache,
            simulation=request.simulation or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchScenarioFlagsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_scenario_flags",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
