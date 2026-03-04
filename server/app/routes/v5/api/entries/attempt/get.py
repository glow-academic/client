"""Attempt entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt.get import get_attempts
from app.sql.types import (
    GetAttemptEntriesApiRequest,
    GetAttemptEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/attempt/get",
    response_model=GetAttemptEntriesApiResponse,
)
async def get_attempt_entries(
    request: GetAttemptEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptEntriesApiResponse:
    """Get attempt entries by IDs."""
    tags = ["entries", "attempt"]

    try:
        items = await get_attempts(conn, request.ids)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAttemptEntriesApiResponse(
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
            operation="get_attempt_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
