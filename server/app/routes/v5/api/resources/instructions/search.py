"""Instructions SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.instructions.search import search_instructions as search_instructions_fn
from app.sql.types import (
    SearchInstructionsApiRequest,
    SearchInstructionsApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/instructions/search",
    response_model=SearchInstructionsApiResponse,
)
async def search_instructions(
    request: SearchInstructionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchInstructionsApiResponse:
    tags = ["resources", "instructions"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_instructions_fn(
            conn,
            get_redis_client(),
            search=request.search,
            limit_count=request.limit_count or 20,
            offset_count=request.offset_count or 0,
            draft_id=request.draft_id,
            suggest_source=request.suggest_source,
            exclude_ids=request.exclude_ids,
            bypass_cache=bypass_cache,
            persona=request.persona or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchInstructionsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_instructions",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
