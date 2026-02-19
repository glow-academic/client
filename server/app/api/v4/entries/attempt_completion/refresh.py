"""Refresh for attempt_completion materialized view."""

import time
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags

MV_NAME = "attempt_completion_mv"

router = APIRouter()


async def refresh_attempt_completion_internal(
    conn: asyncpg.Connection,
) -> dict:
    """Refresh attempt_completion_mv concurrently."""
    start_time = time.time()
    await conn.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {MV_NAME}")
    duration_ms = int((time.time() - start_time) * 1000)
    await invalidate_tags(["entries", "attempt_completion"])
    return {
        "success": True,
        "duration_ms": duration_ms,
        "message": f"Refreshed {MV_NAME} in {duration_ms}ms",
    }


@router.post("/attempt_completion/refresh")
async def refresh_attempt_completion(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the attempt_completion_mv materialized view."""
    try:
        result = await refresh_attempt_completion_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,attempt_completion"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_attempt_completion",
            request=http_request,
        )
