"""Refresh for certificates materialized view."""

import time
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.utils.error.handle_route_error import handle_route_error
from app.infra.globals import get_db
from app.utils.cache.invalidate_tags import invalidate_tags

MV_NAME = "certificates_mv"

router = APIRouter()


async def refresh_certificates_internal(
    conn: asyncpg.Connection,
) -> dict:
    """Refresh certificates_mv concurrently."""
    start_time = time.time()
    await conn.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {MV_NAME}")
    duration_ms = int((time.time() - start_time) * 1000)
    await invalidate_tags(["entries", "certificates"])
    return {
        "success": True,
        "duration_ms": duration_ms,
        "message": f"Refreshed {MV_NAME} in {duration_ms}ms",
    }


@router.post("/certificates/refresh")
async def refresh_certificates(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the certificates_mv materialized view."""
    try:
        result = await refresh_certificates_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,certificates"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_certificates",
            request=http_request,
        )
