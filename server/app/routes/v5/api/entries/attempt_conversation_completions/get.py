"""Conversations Completions entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt_conversation_completions.get import (
    SQL_PATH,
    get_conversations_completions_entries_internal,
)
from app.sql.types import (
    GetConversationsCompletionsEntriesApiRequest,
    GetConversationsCompletionsEntriesApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/attempt_conversation_completions/get",
    response_model=GetConversationsCompletionsEntriesApiResponse,
)
async def get_conversations_completions_entries(
    request: GetConversationsCompletionsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetConversationsCompletionsEntriesApiResponse:
    """Get conversations_completions entries by IDs."""
    tags = ["entries", "attempt_conversation_completions"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_conversations_completions_entries_internal(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetConversationsCompletionsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_conversations_completions_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
