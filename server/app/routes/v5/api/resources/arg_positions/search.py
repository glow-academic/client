"""Arg Positions SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.arg_positions.search import (
    search_arg_positions as search_arg_positions_fn,
)
from app.sql.types import (
    SearchArgPositionsApiRequest,
    SearchArgPositionsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/arg_positions/search",
    response_model=SearchArgPositionsApiResponse,
)
async def search_arg_positions(
    request: SearchArgPositionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchArgPositionsApiResponse:
    """Search arg_positions resources."""
    tags = ["resources", "arg_positions"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_arg_positions_fn(
            conn,
            get_redis_client(),
            limit_count=request.limit_count or 100,
            offset_count=request.offset_count or 0,
            exclude_ids=request.exclude_ids,
            args_ids=request.args_ids,
            bypass_cache=bypass_cache,
            tool=request.tool or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchArgPositionsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_arg_positions",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
