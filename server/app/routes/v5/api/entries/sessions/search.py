"""Sessions entry SEARCH endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.sessions.search import search_sessions
from app.sql.types import (
    SearchSessionsEntriesApiRequest,
    SearchSessionsEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/sessions/search",
    response_model=SearchSessionsEntriesApiResponse,
)
async def search_sessions_entries(
    request: SearchSessionsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchSessionsEntriesApiResponse:
    """Search sessions entries."""
    try:
        items = await search_sessions(
            conn,
            limit=request.limit_count or 20,
            offset=request.offset_count or 0,
        )
        return SearchSessionsEntriesApiResponse(
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
            operation="search_sessions_entries",
            request=http_request,
        )
