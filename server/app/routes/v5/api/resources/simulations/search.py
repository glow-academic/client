"""Simulations SEARCH endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.resources.simulations.types import (
    SearchSimulationsApiRequest,
    SearchSimulationsApiResponse,
)
from app.routes.v5.tools.resources.simulations.search import (
    search_simulations as search_simulations_fn,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/simulations/search", response_model=SearchSimulationsApiResponse)
async def search_simulations(
    request: SearchSimulationsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchSimulationsApiResponse:
    """Search simulations with optional filters."""
    tags = ["resources", "simulations"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        items = await search_simulations_fn(
            conn,
            get_redis_client(),
            search=request.search,
            limit_count=request.limit_count or 20,
            offset_count=request.offset_count or 0,
            draft_id=request.draft_id,
            suggest_source=request.suggest_source,
            exclude_ids=request.exclude_ids,
            bypass_cache=bypass_cache,
        )

        response.headers["X-Cache-Tags"] = ",".join(tags)

        return SearchSimulationsApiResponse(items=items)
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_simulations",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
