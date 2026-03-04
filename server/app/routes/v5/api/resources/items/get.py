"""Items GET endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.items.get import get_items as get_items_resource
from app.sql.types import (
    GetItemsApiRequest,
    GetItemsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/items/get",
    response_model=GetItemsApiResponse,
)
async def get_items(
    request: GetItemsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetItemsApiResponse:
    """Get items resources by IDs."""
    tags = ["resources", "items"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_items_resource(conn, request.ids, get_redis_client(), bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetItemsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_items",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
