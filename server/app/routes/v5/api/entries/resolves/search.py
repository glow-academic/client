"""Resolves entry SEARCH endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.resolves.search import search_resolves
from app.sql.types import (
    SearchResolvesEntriesApiRequest,
    SearchResolvesEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/resolves/search",
    response_model=SearchResolvesEntriesApiResponse,
)
async def search_resolves_entries(
    request: SearchResolvesEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchResolvesEntriesApiResponse:
    """Search resolves entries."""
    tags = ["entries", "resolves"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_resolves(
            conn,
            limit=request.limit_count,
            offset=request.offset_count,
            bypass_mv=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchResolvesEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_resolves_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
