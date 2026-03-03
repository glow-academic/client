"""Simulation availability search endpoint - v4 API."""

from typing import Annotated, Any

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.api.resources.simulation_availability.types import (
    SearchSimulationAvailabilityApiRequest,
    SearchSimulationAvailabilityApiResponse,
)
from app.routes.v5.tools.resources.simulation_availability.search import (
    SQL_PATH,
    search_simulation_availability_internal,
)
from app.sql.types import load_sql_query
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post(
    "/simulation_availability/search",
    response_model=SearchSimulationAvailabilityApiResponse,
)
async def search_simulation_availability(
    request: SearchSimulationAvailabilityApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchSimulationAvailabilityApiResponse:
    tags = ["resources", "simulation_availability"]
    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401, detail="Profile ID is required. Please sign in again."
            )

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        items = await search_simulation_availability_internal(
            conn=conn,
            simulation_ids=request.simulation_ids,
            availability_type=request.availability_type,
            limit_count=request.limit_count,
            offset_count=request.offset_count,
            exclude_ids=request.exclude_ids,
            bypass_cache=bypass_cache,
            cohort=request.cohort or False,
        )

        api_response = SearchSimulationAvailabilityApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_simulation_availability",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
