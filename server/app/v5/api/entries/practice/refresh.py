"""Refresh for practice materialized view."""

import time
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
from app.utils.cache.invalidate_tags import invalidate_tags

MV_NAME = "practice_mv"

router = APIRouter()


async def refresh_practice_internal(
    conn: asyncpg.Connection,
) -> dict:
    """Refresh practice_mv concurrently."""
    start_time = time.time()
    await conn.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {MV_NAME}")
    duration_ms = int((time.time() - start_time) * 1000)
    await invalidate_tags(["entries", "practice"])
    return {
        "success": True,
        "duration_ms": duration_ms,
        "message": f"Refreshed {MV_NAME} in {duration_ms}ms",
    }


@router.post("/practice/refresh")
async def refresh_practice(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the practice_mv materialized view."""
    try:
        result = await refresh_practice_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,practice"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_practice",
            request=http_request,
        )
