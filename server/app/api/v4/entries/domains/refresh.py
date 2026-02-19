"""Refresh for domains materialized view."""

import time
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.utils.cache.invalidate_tags import invalidate_tags

MV_NAME = "domains_mv"

router = APIRouter()


async def refresh_domains_internal(
    conn: asyncpg.Connection,
) -> dict:
    """Refresh domains_mv concurrently."""
    start_time = time.time()
    await conn.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {MV_NAME}")
    duration_ms = int((time.time() - start_time) * 1000)
    await invalidate_tags(["entries", "domains"])
    return {
        "success": True,
        "duration_ms": duration_ms,
        "message": f"Refreshed {MV_NAME} in {duration_ms}ms",
    }


@router.post("/domains/refresh")
async def refresh_domains(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the domains_mv materialized view."""
    try:
        result = await refresh_domains_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,domains"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_domains",
            request=http_request,
        )
