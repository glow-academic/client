"""Request Limits GET endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.request_limits.get import (
    get_request_limits as get_request_limits_resource,
)
from app.sql.types import (
    GetRequestLimitsApiRequest,
    GetRequestLimitsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/request_limits/get",
    response_model=GetRequestLimitsApiResponse,
)
async def get_request_limits(
    request: GetRequestLimitsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetRequestLimitsApiResponse:
    """Get request_limits resources by IDs."""
    tags = ["resources", "request_limits"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_request_limits_resource(
            conn, request.ids, get_redis_client(), bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetRequestLimitsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_request_limits",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
