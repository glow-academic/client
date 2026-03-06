"""Scenarios SEARCH endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.main.simulation.types import (
    SearchScenariosApiRequest,
    SearchScenariosApiResponse,
)
from app.routes.v5.tools.resources.scenarios.search import (
    search_scenarios as search_scenarios_fn,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/scenarios/search", response_model=SearchScenariosApiResponse)
async def search_scenarios(
    request: SearchScenariosApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchScenariosApiResponse:
    """Search scenarios with filtering and pagination."""
    tags = ["resources", "scenarios"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_scenarios_fn(
            conn,
            get_redis_client(),
            search=request.search,
            limit_count=request.limit_count or 20,
            offset_count=request.offset_count or 0,
            department_ids=request.department_ids,
            suggest_source=request.suggest_source,
            exclude_ids=request.exclude_ids,
            bypass_cache=bypass_cache,
            scenario=request.scenario or False,
            simulation=request.simulation or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchScenariosApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_scenarios",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
