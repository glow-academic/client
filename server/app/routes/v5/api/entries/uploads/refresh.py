"""Refresh for uploads materialized view."""

import time
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db
from app.utils.cache.invalidate_tags import invalidate_tags

MV_NAME = "uploads_mv"

router = APIRouter()


async def refresh_uploads_internal(
    conn: asyncpg.Connection,
) -> dict:
    """Refresh uploads_mv concurrently."""
    start_time = time.time()
    await conn.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {MV_NAME}")
    duration_ms = int((time.time() - start_time) * 1000)
    await invalidate_tags(["entries", "uploads"])
    return {
        "success": True,
        "duration_ms": duration_ms,
        "message": f"Refreshed {MV_NAME} in {duration_ms}ms",
    }


@router.post("/uploads/refresh")
async def refresh_uploads(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the uploads_mv materialized view."""
    try:
        result = await refresh_uploads_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,uploads"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_uploads",
            request=http_request,
        )
