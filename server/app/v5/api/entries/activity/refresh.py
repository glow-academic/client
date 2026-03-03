"""Refresh for activity materialized view."""

import time
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db
from app.v5.utils.cache.invalidate_tags import invalidate_tags

MV_NAME = "activity_mv"

router = APIRouter()


async def refresh_activity_internal(
    conn: asyncpg.Connection,
) -> dict:
    """Refresh activity_mv concurrently."""
    start_time = time.time()
    await conn.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {MV_NAME}")
    duration_ms = int((time.time() - start_time) * 1000)
    await invalidate_tags(["entries", "activity"])
    return {
        "success": True,
        "duration_ms": duration_ms,
        "message": f"Refreshed {MV_NAME} in {duration_ms}ms",
    }


@router.post("/activity/refresh")
async def refresh_activity(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the activity_mv materialized view."""
    try:
        result = await refresh_activity_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,activity"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_activity",
            request=http_request,
        )
