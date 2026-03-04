"""Refresh for test materialized view."""

import time
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.test.refresh import refresh_test
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/test/refresh")
async def refresh_test_route(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the test_mv materialized view."""
    try:
        start_time = time.time()
        await refresh_test(conn)
        duration_ms = int((time.time() - start_time) * 1000)
        response.headers["X-Cache-Tags"] = "entries,test"
        return {
            "success": True,
            "duration_ms": duration_ms,
            "message": f"Refreshed test_mv in {duration_ms}ms",
        }
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_test",
            request=http_request,
        )
