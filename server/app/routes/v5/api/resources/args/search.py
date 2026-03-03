"""Args SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.args.search import SQL_PATH, search_args_internal
from app.sql.types import (
    SearchArgsApiRequest,
    SearchArgsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

# Load SQL with types at module level
router = APIRouter()

@router.post(
    "/args/search",
    response_model=SearchArgsApiResponse,
)
async def search_args(
    request: SearchArgsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchArgsApiResponse:
    """Search args resources."""
    tags = ["resources", "args"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_args_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.draft_id,
            request.suggest_source,
            request.exclude_ids,
            bypass_cache=bypass_cache,
            tool=request.tool or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchArgsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_args",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
