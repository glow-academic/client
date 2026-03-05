"""Messages entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.messages.get import get_message
from app.sql.types import (
    GetMessagesEntriesApiRequest,
    GetMessagesEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/messages/get",
    response_model=GetMessagesEntriesApiResponse,
)
async def get_messages_entries(
    request: GetMessagesEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetMessagesEntriesApiResponse:
    """Get messages entries by IDs."""
    tags = ["entries", "messages"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_message(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetMessagesEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_messages_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
