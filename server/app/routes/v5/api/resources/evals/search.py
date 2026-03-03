"""Evals SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.evals.search import SQL_PATH, search_evals_internal
from app.sql.types import (
    SearchEvalsApiRequest,
    SearchEvalsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post(
    "/evals/search",
    response_model=SearchEvalsApiResponse,
)
async def search_evals(
    request: SearchEvalsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchEvalsApiResponse:
    tags = ["resources", "evals"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_evals_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            bypass_cache=bypass_cache,
            eval=request.eval or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchEvalsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_evals",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
