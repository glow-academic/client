"""Prompts SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.prompts.search import search_prompts as search_prompts_fn
from app.sql.types import (
    SearchPromptsApiRequest,
    SearchPromptsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/prompts/search",
    response_model=SearchPromptsApiResponse,
)
async def search_prompts(
    request: SearchPromptsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchPromptsApiResponse:
    """Search prompts resources."""
    tags = ["resources", "prompts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_prompts_fn(
            conn,
            get_redis_client(),
            search=request.search,
            limit_count=request.limit_count or 20,
            offset_count=request.offset_count or 0,
            exclude_ids=request.exclude_ids,
            bypass_cache=bypass_cache,
            agent=request.agent or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchPromptsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_prompts",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
