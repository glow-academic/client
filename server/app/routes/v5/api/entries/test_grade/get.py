"""Test Grade entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.test_grade.get import get_test_grades
from app.sql.types import (
    GetTestGradeEntriesApiRequest,
    GetTestGradeEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/test_grade/get",
    response_model=GetTestGradeEntriesApiResponse,
)
async def get_test_grade_entries(
    request: GetTestGradeEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTestGradeEntriesApiResponse:
    """Get test_grade entries by IDs."""
    tags = ["entries", "test_grade"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_test_grades(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetTestGradeEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_test_grade_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
