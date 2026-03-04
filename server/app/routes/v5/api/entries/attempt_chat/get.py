"""Attempt Chat entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt_chat.get import get_attempt_chats
from app.sql.types import (
    GetAttemptChatEntriesApiRequest,
    GetAttemptChatEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/attempt_chat/get",
    response_model=GetAttemptChatEntriesApiResponse,
)
async def get_attempt_chat_entries(
    request: GetAttemptChatEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptChatEntriesApiResponse:
    """Get attempt_chat entries by IDs."""
    tags = ["entries", "attempt_chat"]

    try:
        items = await get_attempt_chats(conn, request.ids)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAttemptChatEntriesApiResponse(
            items=[item.model_dump(mode="json") for item in items]
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_attempt_chat_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
