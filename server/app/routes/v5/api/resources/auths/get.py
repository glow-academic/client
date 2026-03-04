"""Auths GET endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.auths.get import get_auths
from app.sql.types import (
    GetAuthsApiRequest,
    GetAuthsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/auths/get",
    response_model=GetAuthsApiResponse,
)
async def get_auths(
    request: GetAuthsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAuthsApiResponse:
    """Get auths resources by IDs.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "auths"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_auths(
            conn, request.ids, get_redis_client(), bypass_cache=bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAuthsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_auths",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
