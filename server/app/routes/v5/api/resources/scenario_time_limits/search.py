"""Scenario Time Limits SEARCH endpoint — v5 API."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.scenario_time_limits.search import (
    search_scenario_time_limits as search_scenario_time_limits_fn,
)
from app.sql.types import (
    SearchScenarioTimeLimitsApiRequest,
    SearchScenarioTimeLimitsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/scenario_time_limits/search",
    response_model=SearchScenarioTimeLimitsApiResponse,
)
async def search_scenario_time_limits(
    request: SearchScenarioTimeLimitsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchScenarioTimeLimitsApiResponse:
    """Search scenario_time_limits resources."""
    tags = ["resources", "scenario_time_limits"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_scenario_time_limits_fn(
            conn,
            get_redis_client(),
            search=None,
            limit_count=20,
            offset_count=0,
            exclude_ids=None,
            scenario_ids=request.scenario_ids,
            negative=request.negative,
            bypass_cache=bypass_cache,
            simulation=request.simulation or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchScenarioTimeLimitsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_scenario_time_limits",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
