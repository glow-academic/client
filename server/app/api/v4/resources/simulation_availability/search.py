"""Simulation availability search endpoint - v4 API."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.resources.simulation_availability.types import (
    SearchSimulationAvailabilityApiRequest,
    SearchSimulationAvailabilityApiResponse,
    SearchSimulationAvailabilitySqlParams,
    SearchSimulationAvailabilitySqlRow,
    SimulationAvailabilityV4Item,
)
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import load_sql_query
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/simulation_availability/search_simulation_availability_complete.sql"

router = APIRouter()


async def search_simulation_availability_internal(
    conn: asyncpg.Connection,
    simulation_ids: list[UUID] | None = None,
    availability_type: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    cohort: bool = False,
) -> list[SimulationAvailabilityV4Item]:
    cache_key_val = cache_key(
        "simulation_availability/search",
        {
            "simulation_ids": sorted([str(id) for id in (simulation_ids or [])]),
            "availability_type": availability_type,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": sorted([str(id) for id in (exclude_ids or [])]),
            "cohort": cohort,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                SimulationAvailabilityV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    params = SearchSimulationAvailabilitySqlParams(
        simulation_ids=simulation_ids or [],
        availability_type=availability_type,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        cohort=cohort,
    )

    result = cast(
        SearchSimulationAvailabilitySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items = result.items or []

    await set_cached(
        cache_key_val,
        {"data": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["simulation_availability"],
    )

    return items


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
