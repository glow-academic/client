"""Test Archive entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.test_archive.get import (
    SQL_PATH,
    get_test_archive_entries_internal,
)
from app.sql.types import (
    GetTestArchiveEntriesApiRequest,
    GetTestArchiveEntriesApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/test_archive/get",
    response_model=GetTestArchiveEntriesApiResponse,
)
async def get_test_archive_entries(
    request: GetTestArchiveEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTestArchiveEntriesApiResponse:
    """Get test_archive entries by IDs."""
    tags = ["entries", "test_archive"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_test_archive_entries_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetTestArchiveEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_test_archive_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
