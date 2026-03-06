"""Auth item keys GET endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.auth_item_keys.get import (
    get_auth_item_keys as get_auth_item_keys_resource,
)
from app.sql.types import (
    GetAuthItemKeysApiRequest,
    GetAuthItemKeysApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/auth_item_keys/get",
    response_model=GetAuthItemKeysApiResponse,
)
async def get_auth_item_keys(
    request: GetAuthItemKeysApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAuthItemKeysApiResponse:
    """Get auth_item_keys resources by IDs."""
    tags = ["resources", "auth_item_keys"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_auth_item_keys_resource(
            conn, request.ids, get_redis_client(), bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAuthItemKeysApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_auth_item_keys",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
