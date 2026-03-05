"""Attempt Feedback entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt_feedback.get import get_attempt_feedbacks
from app.sql.types import (
    GetAttemptFeedbackEntriesApiRequest,
    GetAttemptFeedbackEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/attempt_feedback/get",
    response_model=GetAttemptFeedbackEntriesApiResponse,
)
async def get_attempt_feedback_entries(
    request: GetAttemptFeedbackEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptFeedbackEntriesApiResponse:
    """Get attempt_feedback entries by IDs."""
    tags = ["entries", "attempt_feedback"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_attempt_feedbacks(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAttemptFeedbackEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_attempt_feedback_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
