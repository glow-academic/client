"""Agents GET endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.agents.get import get_agents as get_agents_resource
from app.sql.types import (
    GetAgentsApiRequest,
    GetAgentsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

# Load SQL with types at module level
router = APIRouter()


@router.post(
    "/agents/get",
    response_model=GetAgentsApiResponse,
)
async def get_agents(
    request: GetAgentsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAgentsApiResponse:
    """Get agents resources by IDs.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "agents"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_agents_resource(conn, request.ids, get_redis_client(), bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAgentsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_agents",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
