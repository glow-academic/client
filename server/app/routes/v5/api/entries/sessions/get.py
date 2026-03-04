"""Sessions entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.sessions.get import get_sessions
from app.sql.types import (
    GetSessionsEntriesApiRequest,
    GetSessionsEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

@router.post(
    "/sessions/get",
    response_model=GetSessionsEntriesApiResponse,
)
async def get_sessions_entries(
    request: GetSessionsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSessionsEntriesApiResponse:
    """Get sessions entries by IDs."""
    try:
        items = await get_sessions(conn, request.ids)
        return GetSessionsEntriesApiResponse(
            items=[item.model_dump(mode="json") for item in items],
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_sessions_entries",
            request=http_request,
        )
