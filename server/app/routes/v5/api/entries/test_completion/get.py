"""Test Completion entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.test_completion.get import get_test_completions
from app.sql.types import (
    GetTestCompletionEntriesApiRequest,
    GetTestCompletionEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/test_completion/get",
    response_model=GetTestCompletionEntriesApiResponse,
)
async def get_test_completion_entries(
    request: GetTestCompletionEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTestCompletionEntriesApiResponse:
    """Get test_completion entries by IDs."""
    tags = ["entries", "test_completion"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_test_completions(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetTestCompletionEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_test_completion_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
