"""Attempt Content entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt_content.get import get_attempt_contents
from app.sql.types import (
    GetAttemptContentEntriesApiRequest,
    GetAttemptContentEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/attempt_content/get",
    response_model=GetAttemptContentEntriesApiResponse,
)
async def get_attempt_content_entries(
    request: GetAttemptContentEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptContentEntriesApiResponse:
    """Get attempt_content entries by IDs."""
    tags = ["entries", "attempt_content"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_attempt_contents(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAttemptContentEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_attempt_content_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
