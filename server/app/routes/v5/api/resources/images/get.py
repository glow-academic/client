"""Images GET endpoint - v4 API.

Provides get endpoint for fetching a single image by ID.
"""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.api.resources.images.types import (
    GetImageApiRequest,
    GetImageApiResponse,
)
from app.routes.v5.tools.resources.images.get import get_images as get_images_resource
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================

# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/images/get",
    response_model=GetImageApiResponse,
)
async def get_image(
    request: GetImageApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetImageApiResponse:
    """Get image by ID."""
    tags = ["resources", "images"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        items = await get_images_resource(
            conn=conn,
            ids=[request.id],
            redis=get_redis_client(),
            bypass_cache=bypass_cache,
        )
        item = items[0] if items else None
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetImageApiResponse(item=item)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_image",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
