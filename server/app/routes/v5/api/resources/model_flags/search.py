"""Model flags SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.model_flags.search import (
    search_model_flags as search_model_flags_fn,
)
from app.sql.types import (
    SearchModelFlagsApiRequest,
    SearchModelFlagsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/model_flags/search",
    response_model=SearchModelFlagsApiResponse,
)
async def search_model_flags(
    request: SearchModelFlagsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchModelFlagsApiResponse:
    """Search available model flags for models."""
    tags = ["resources", "model_flags"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_model_flags_fn(
            conn,
            get_redis_client(),
            search=request.search,
            limit_count=request.limit_count or 20,
            offset_count=request.offset_count or 0,
            exclude_ids=request.exclude_ids,
            model_ids=request.model_ids,
            flag_ids=request.flag_ids,
            bypass_cache=bypass_cache,
            eval=request.eval or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchModelFlagsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_model_flags",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
