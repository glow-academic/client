"""Simulation availability create endpoint - v4 API."""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.sql.types import (
    SimulationAvailabilityApiRequest,
    SimulationAvailabilityApiResponse,
    SimulationAvailabilitySqlParams,
    SimulationAvailabilitySqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/simulation_availability_complete.sql"

router = APIRouter()


@router.post(
    "/simulation_availability", response_model=SimulationAvailabilityApiResponse
)
async def create_simulation_availability(
    request: SimulationAvailabilityApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SimulationAvailabilityApiResponse:
    """Create simulation_availability resource (always INSERT)."""
    tags = ["resources", "simulation_availability"]
    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401, detail="Profile ID is required. Please sign in again."
            )

        async with conn.transaction():
            mcp = getattr(http_request.state, "mcp", False) or False

            request_dict = request.model_dump()
            request_dict["mcp"] = mcp
            params = SimulationAvailabilitySqlParams(**request_dict)
            sql_params = params.to_tuple()

            result = cast(
                SimulationAvailabilitySqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.id:
                raise ValueError("Failed to create simulation_availability")

        api_response = SimulationAvailabilityApiResponse.model_validate(
            result.model_dump()
        )
        await invalidate_tags(tags, redis=get_redis_client())
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        return api_response
    except HTTPException:
        raise
    except asyncpg.ForeignKeyViolationError as e:
        raise HTTPException(
            status_code=400, detail=f"Referenced entity does not exist: {e}"
        ) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_simulation_availability",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
