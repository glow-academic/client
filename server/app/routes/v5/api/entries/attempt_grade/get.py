"""Attempt Grade entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.attempt_grade.get import get_attempt_grades
from app.sql.types import (
    GetAttemptGradeEntriesApiRequest,
    GetAttemptGradeEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/attempt_grade/get",
    response_model=GetAttemptGradeEntriesApiResponse,
)
async def get_attempt_grade_entries(
    request: GetAttemptGradeEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptGradeEntriesApiResponse:
    """Get attempt_grade entries by IDs."""
    tags = ["entries", "attempt_grade"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_attempt_grades(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAttemptGradeEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_attempt_grade_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
