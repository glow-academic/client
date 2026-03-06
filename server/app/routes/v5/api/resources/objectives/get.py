"""Objectives GET endpoint - v4 API.

Provides get endpoint for fetching a single objective by ID.
"""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.resources.objectives.types import (
    GetObjectiveApiRequest,
    GetObjectiveApiResponse,
)
from app.routes.v5.tools.resources.objectives.get import (
    get_objectives as get_objectives_resource,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================

# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/objectives/get",
    response_model=GetObjectiveApiResponse,
)
async def get_objective(
    request: GetObjectiveApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetObjectiveApiResponse:
    """Get objective by ID."""
    tags = ["resources", "objectives"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        items = await get_objectives_resource(
            conn, [request.id], get_redis_client(), bypass_cache
        )
        item = items[0] if items else None
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetObjectiveApiResponse(item=item)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_objective",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
