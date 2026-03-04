"""Simulation availability get endpoint - v4 API."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.resources.simulation_availability.types import (
    GetSimulationAvailabilityApiRequest,
    GetSimulationAvailabilityApiResponse,
)
from app.routes.v5.tools.resources.simulation_availability.get import (
    get_simulation_availability as get_simulation_availability_resource,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/simulation_availability/get",
    response_model=GetSimulationAvailabilityApiResponse,
)
async def get_simulation_availability(
    request: GetSimulationAvailabilityApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSimulationAvailabilityApiResponse:
    tags = ["resources", "simulation_availability"]
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401, detail="Profile ID is required. Please sign in again."
            )

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        items = await get_simulation_availability_resource(
            conn=conn,
            ids=request.ids or [],
            redis=get_redis_client(),
            bypass_cache=bypass_cache,
        )

        api_response = GetSimulationAvailabilityApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_simulation_availability",
            sql_query=None,
            sql_params=sql_params,
            request=http_request,
        )
