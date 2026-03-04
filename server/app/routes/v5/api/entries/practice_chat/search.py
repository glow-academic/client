"""Practice Chat entry SEARCH endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.practice_chat.search import (
    SQL_PATH,
    search_practice_chat_entries_internal,
)
from app.sql.types import (
    SearchPracticeChatEntriesApiRequest,
    SearchPracticeChatEntriesApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/practice_chat/search",
    response_model=SearchPracticeChatEntriesApiResponse,
)
async def search_practice_chat_entries(
    request: SearchPracticeChatEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchPracticeChatEntriesApiResponse:
    """Search practice_chat entries."""
    tags = ["entries", "practice_chat"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_practice_chat_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            practice_id=request.practice_id,
            chat_id=request.chat_id,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchPracticeChatEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_practice_chat_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
