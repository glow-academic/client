"""Refresh for leaderboard_insights materialized view."""

import time
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags

MV_NAME = "leaderboard_insights_mv"

router = APIRouter()


async def refresh_leaderboard_insights_internal(
    conn: asyncpg.Connection,
) -> dict:
    """Refresh leaderboard_insights_mv concurrently."""
    start_time = time.time()
    await conn.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {MV_NAME}")
    duration_ms = int((time.time() - start_time) * 1000)
    await invalidate_tags(["entries", "leaderboard_insights"])
    return {
        "success": True,
        "duration_ms": duration_ms,
        "message": f"Refreshed {MV_NAME} in {duration_ms}ms",
    }


@router.post("/leaderboard_insights/refresh")
async def refresh_leaderboard_insights(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the leaderboard_insights_mv materialized view."""
    try:
        result = await refresh_leaderboard_insights_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,leaderboard_insights"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_leaderboard_insights",
            request=http_request,
        )
