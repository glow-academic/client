"""Auth item keys SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.auth_item_keys.search import (
    search_auth_item_keys as search_auth_item_keys_fn,
)
from app.sql.types import (
    SearchAuthItemKeysApiRequest,
    SearchAuthItemKeysApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/auth_item_keys/search",
    response_model=SearchAuthItemKeysApiResponse,
)
async def search_auth_item_keys(
    request: SearchAuthItemKeysApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchAuthItemKeysApiResponse:
    tags = ["resources", "auth_item_keys"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_auth_item_keys_fn(
            conn,
            get_redis_client(),
            search=request.search,
            limit_count=request.limit_count or 20,
            offset_count=request.offset_count or 0,
            exclude_ids=request.exclude_ids,
            bypass_cache=bypass_cache,
            setting=request.setting or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchAuthItemKeysApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_auth_item_keys",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
