"""Test Stop entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.test_stop.get import get_test_stops
from app.sql.types import (
    GetTestStopEntriesApiRequest,
    GetTestStopEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/test_stop/get",
    response_model=GetTestStopEntriesApiResponse,
)
async def get_test_stop_entries(
    request: GetTestStopEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTestStopEntriesApiResponse:
    """Get test_stop entries by IDs."""
    tags = ["entries", "test_stop"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_test_stops(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetTestStopEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_test_stop_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
