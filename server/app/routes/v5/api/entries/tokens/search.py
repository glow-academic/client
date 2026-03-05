"""Tokens entry SEARCH endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.tokens.search import search_tokens
from app.sql.types import (
    SearchTokensEntriesApiRequest,
    SearchTokensEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/tokens/search",
    response_model=SearchTokensEntriesApiResponse,
)
async def search_tokens_entries(
    request: SearchTokensEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchTokensEntriesApiResponse:
    """Search tokens entries."""
    tags = ["entries", "tokens"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_tokens(
            conn,
            limit=request.limit_count,
            offset=request.offset_count,
            bypass_mv=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchTokensEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_tokens_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
