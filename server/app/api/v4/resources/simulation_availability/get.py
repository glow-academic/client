"""Simulation availability get endpoint - v4 API."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.resources.simulation_availability.types import (
    GetSimulationAvailabilityApiRequest,
    GetSimulationAvailabilityApiResponse,
    GetSimulationAvailabilitySqlParams,
    GetSimulationAvailabilitySqlRow,
    SimulationAvailabilityV4Item,
)
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import load_sql_query
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/resources/simulation_availability/get_simulation_availability_complete.sql"

router = APIRouter()


async def get_simulation_availability_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[SimulationAvailabilityV4Item]:
    if not ids:
        return []

    ids = [UUID(sid) if isinstance(sid, str) else sid for sid in ids if sid is not None]
    if not ids:
        return []

    cache_key_val = cache_key(
        "simulation_availability/get",
        {"ids": sorted([str(id) for id in ids])},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                SimulationAvailabilityV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    params = GetSimulationAvailabilitySqlParams(ids=ids)
    result = cast(
        GetSimulationAvailabilitySqlRow,
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
    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401, detail="Profile ID is required. Please sign in again."
            )

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        items = await get_simulation_availability_internal(
            conn=conn,
            ids=request.ids,
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
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
