"""Debug Info entry SEARCH endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.debug_info.search import search_debug_info
from app.sql.types import (
    SearchDebugInfoEntriesApiRequest,
    SearchDebugInfoEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/debug_info/search",
    response_model=SearchDebugInfoEntriesApiResponse,
)
async def search_debug_info_entries(
    request: SearchDebugInfoEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchDebugInfoEntriesApiResponse:
    """Search debug_info entries."""
    tags = ["entries", "debug_info"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_debug_info(
            conn,
            limit=request.limit_count,
            offset=request.offset_count,
            bypass_mv=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchDebugInfoEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_debug_info_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
