"""Tools GET endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.tools.get import get_tools
from app.sql.types import (
    GetToolsApiRequest,
    GetToolsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post(
    "/tools/get",
    response_model=GetToolsApiResponse,
)
async def get_tools_endpoint(
    request: GetToolsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetToolsApiResponse:
    """Get tools resources by IDs."""
    tags = ["resources", "tools"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_tools(conn, request.ids, get_redis_client(), bypass_cache=bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetToolsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_tools",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
