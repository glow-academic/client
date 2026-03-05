"""Attempt Replacement entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt_replacement.get import get_attempt_replacements
from app.sql.types import (
    GetAttemptReplacementEntriesApiRequest,
    GetAttemptReplacementEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/attempt_replacement/get",
    response_model=GetAttemptReplacementEntriesApiResponse,
)
async def get_attempt_replacement_entries(
    request: GetAttemptReplacementEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptReplacementEntriesApiResponse:
    """Get attempt_replacement entries by IDs."""
    tags = ["entries", "attempt_replacement"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_attempt_replacements(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAttemptReplacementEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_attempt_replacement_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
