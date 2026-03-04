"""Icons GET endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.icons.get import get_icons as get_icons_resource
from app.sql.types import (
    GetIconsApiRequest,
    GetIconsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

# Load SQL with types at module level
router = APIRouter()


@router.post(
    "/icons/get",
    response_model=GetIconsApiResponse,
)
async def get_icons(
    request: GetIconsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetIconsApiResponse:
    """Get icons resources by IDs.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "icons"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_icons_resource(conn, request.ids, get_redis_client(), bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetIconsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_icons",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
