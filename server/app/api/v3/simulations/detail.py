"""Simulation detail endpoint - v3 API following DHH principles."""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetSimulationDetailApiRequest,
                           GetSimulationDetailApiResponse,
                           GetSimulationDetailSqlParams, GetSimulationDetailSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level
SQL_PATH = "app/sql/v3/simulations/get_simulation_detail_complete.sql"


router = APIRouter()


@router.post(
    "/detail",
    response_model=GetSimulationDetailApiResponse,
    dependencies=[
        audit_activity(
            "simulation.viewed",
            "{{ actor.name }} viewed simulation '{{ simulation.name }}'",
        )
    ],
)
async def get_simulation_detail(
    request_data: GetSimulationDetailApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSimulationDetailApiResponse:
    """Get detailed simulation information."""
    tags = ["simulations"]

    # Generate cache key from path and parsed body
    body_dict = request_data.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetSimulationDetailApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params
        params = GetSimulationDetailSqlParams(
            simulation_id=request_data.simulation_id,
            profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper
        result = cast(
            GetSimulationDetailSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if simulation exists
        if not result.simulation_exists:
            raise HTTPException(
                status_code=404,
                detail=f"Simulation not found: {request_data.simulation_id}",
            )

        # Set audit context
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                simulation={"name": result.name or "", "id": str(request_data.simulation_id)},
            )

        # Convert SQL result to API response (no manual filtering needed - SQL handles it)
        api_response = GetSimulationDetailApiResponse.model_validate(result.model_dump())

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode='json')},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_simulation_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
