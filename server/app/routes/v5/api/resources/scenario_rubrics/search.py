"""Scenario rubrics SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.scenario_rubrics.search import (
    search_scenario_rubrics as search_scenario_rubrics_fn,
)
from app.sql.types import (
    SearchScenarioRubricsApiRequest,
    SearchScenarioRubricsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/scenario_rubrics/search",
    response_model=SearchScenarioRubricsApiResponse,
)
async def search_scenario_rubrics(
    request: SearchScenarioRubricsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchScenarioRubricsApiResponse:
    """Search available scenario rubrics for scenarios."""
    tags = ["resources", "scenario_rubrics"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_scenario_rubrics_fn(
            conn,
            get_redis_client(),
            scenario_ids=request.scenario_ids,
            rubric_ids=request.rubric_ids,
            bypass_cache=bypass_cache,
            simulation=request.simulation or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchScenarioRubricsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_scenario_rubrics",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
