"""Attempt Analysis entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt_analysis.get import get_attempt_analyses
from app.sql.types import (
    GetAttemptAnalysisEntriesApiRequest,
    GetAttemptAnalysisEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/attempt_analysis/get",
    response_model=GetAttemptAnalysisEntriesApiResponse,
)
async def get_attempt_analysis_entries(
    request: GetAttemptAnalysisEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptAnalysisEntriesApiResponse:
    """Get attempt_analysis entries by IDs."""
    tags = ["entries", "attempt_analysis"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_attempt_analyses(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAttemptAnalysisEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_attempt_analysis_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
