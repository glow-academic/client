"""Personas SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.personas.search import (
    SQL_PATH,
    search_personas_internal,
)
from app.sql.types import (
    SearchPersonasApiRequest,
    SearchPersonasApiResponse,
    load_sql_query,
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
    tags = ["resources", "personas"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_personas_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.department_ids,
            request.draft_id,
            request.suggest_source,
            request.exclude_ids,
            bypass_cache,
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
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
