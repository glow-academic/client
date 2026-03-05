"""Reasoning Levels SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.reasoning_levels.search import (
    search_reasoning_levels as search_reasoning_levels_fn,
)
from app.sql.types import (
    SearchReasoningLevelsApiRequest,
    SearchReasoningLevelsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/reasoning_levels/search",
    response_model=SearchReasoningLevelsApiResponse,
)
async def search_reasoning_levels(
    request: SearchReasoningLevelsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchReasoningLevelsApiResponse:
    """Search reasoning_levels resources."""
    tags = ["resources", "reasoning_levels"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_reasoning_levels_fn(
            conn,
            get_redis_client(),
            search=request.search,
            limit_count=request.limit_count or 20,
            offset_count=request.offset_count or 0,
            exclude_ids=request.exclude_ids,
            bypass_cache=bypass_cache,
            agent=request.agent or False,
            model=request.model or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchReasoningLevelsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_reasoning_levels",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
