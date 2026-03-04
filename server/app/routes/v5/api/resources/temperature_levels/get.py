"""Temperature Levels GET endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.temperature_levels.get import (
    get_temperature_levels as get_temperature_levels_resource,
)
from app.sql.types import (
    GetTemperatureLevelsApiRequest,
    GetTemperatureLevelsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

# Load SQL with types at module level
router = APIRouter()


@router.post(
    "/temperature_levels/get",
    response_model=GetTemperatureLevelsApiResponse,
)
async def get_temperature_levels(
    request: GetTemperatureLevelsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTemperatureLevelsApiResponse:
    """Get temperature_levels resources by IDs.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "temperature_levels"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_temperature_levels_resource(conn, request.ids, get_redis_client(), bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetTemperatureLevelsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_temperature_levels",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
