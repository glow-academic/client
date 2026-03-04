"""Attempt Message entry SEARCH endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt_message.search import (
    SQL_PATH,
    search_attempt_message_entries_internal,
)
from app.sql.types import (
    SearchAttemptMessageEntriesApiRequest,
    SearchAttemptMessageEntriesApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/attempt_message/search",
    response_model=SearchAttemptMessageEntriesApiResponse,
)
async def search_attempt_message_entries(
    request: SearchAttemptMessageEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchAttemptMessageEntriesApiResponse:
    """Search attempt_message entries."""
    tags = ["entries", "attempt_message"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_attempt_message_entries_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            bypass_cache=bypass_cache,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchAttemptMessageEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_attempt_message_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
