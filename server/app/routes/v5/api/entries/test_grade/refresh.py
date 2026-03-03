"""Refresh for test_grade materialized view."""

import time
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db
from app.utils.cache.invalidate_tags import invalidate_tags

MV_NAME = "test_grade_mv"

router = APIRouter()


async def refresh_test_grade_internal(
    conn: asyncpg.Connection,
) -> dict:
    """Refresh test_grade_mv concurrently."""
    start_time = time.time()
    await conn.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {MV_NAME}")
    duration_ms = int((time.time() - start_time) * 1000)
    await invalidate_tags(["entries", "test_grade"])
    return {
        "success": True,
        "duration_ms": duration_ms,
        "message": f"Refreshed {MV_NAME} in {duration_ms}ms",
    }


@router.post("/test_grade/refresh")
async def refresh_test_grade(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the test_grade_mv materialized view."""
    try:
        result = await refresh_test_grade_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,test_grade"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_test_grade",
            request=http_request,
        )
