"""Refresh for test_completion materialized view."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.test_completion.refresh import (
    refresh_test_completion as refresh_test_completion_impl,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/test_completion/refresh")
async def refresh_test_completion(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the test_completion_mv materialized view."""
    try:
        result = await refresh_test_completion_impl(conn)
        response.headers["X-Cache-Tags"] = "entries,test_completion"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_test_completion",
            request=http_request,
        )
