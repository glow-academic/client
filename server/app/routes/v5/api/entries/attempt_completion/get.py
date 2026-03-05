"""Attempt Completion entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt_completion.get import get_attempt_completions
from app.sql.types import (
    GetAttemptCompletionEntriesApiRequest,
    GetAttemptCompletionEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/attempt_completion/get",
    response_model=GetAttemptCompletionEntriesApiResponse,
)
async def get_attempt_completion_entries(
    request: GetAttemptCompletionEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptCompletionEntriesApiResponse:
    """Get attempt_completion entries by IDs."""
    tags = ["entries", "attempt_completion"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_attempt_completions(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAttemptCompletionEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_attempt_completion_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
