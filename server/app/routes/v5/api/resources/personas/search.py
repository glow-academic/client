"""Personas SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.personas.search import (
    search_personas as search_personas_fn,
)
from app.sql.types import (
    SearchPersonasApiRequest,
    SearchPersonasApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/personas/search",
    response_model=SearchPersonasApiResponse,
)
async def search_personas(
    request: SearchPersonasApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchPersonasApiResponse:
    """Search personas resources."""
    tags = ["resources", "personas"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_personas_fn(
            conn,
            get_redis_client(),
            search=request.search,
            limit_count=request.limit_count or 20,
            offset_count=request.offset_count or 0,
            draft_id=request.draft_id,
            suggest_source=request.suggest_source,
            exclude_ids=request.exclude_ids,
            department_ids=request.department_ids,
            bypass_cache=bypass_cache,
            persona=request.persona or False,
            scenario=request.scenario or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchPersonasApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_personas",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
