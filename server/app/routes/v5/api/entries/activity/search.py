"""Activity entry SEARCH endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.activity.search import search_activity
from app.sql.types import (
    SearchActivityEntriesApiRequest,
    SearchActivityEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/activity/search",
    response_model=SearchActivityEntriesApiResponse,
)
async def search_activity_entries(
    request: SearchActivityEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchActivityEntriesApiResponse:
    """Search activity entries."""
    tags = ["entries", "activity"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_activity(
            conn,
            limit=request.limit_count,
            offset=request.offset_count,
            bypass_mv=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchActivityEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_activity_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
