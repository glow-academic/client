"""Groups entry SEARCH endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.groups.search import search_groups
from app.sql.types import (
    SearchGroupsEntriesApiRequest,
    SearchGroupsEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/groups/search",
    response_model=SearchGroupsEntriesApiResponse,
)
async def search_groups_entries(
    request: SearchGroupsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchGroupsEntriesApiResponse:
    """Search groups entries."""
    tags = ["entries", "groups"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_groups(
            conn,
            limit=request.limit_count,
            offset=request.offset_count,
            bypass_mv=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchGroupsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_groups_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
