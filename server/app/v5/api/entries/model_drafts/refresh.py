"""Refresh for model_drafts materialized view."""

import time
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.utils.cache.invalidate_tags import invalidate_tags

MV_NAME = "model_drafts_mv"

router = APIRouter()


async def refresh_model_drafts_internal(
    conn: asyncpg.Connection,
) -> dict:
    """Refresh model_drafts_mv concurrently."""
    start_time = time.time()
    await conn.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {MV_NAME}")
    duration_ms = int((time.time() - start_time) * 1000)
    await invalidate_tags(["entries", "model_drafts"])
    return {
        "success": True,
        "duration_ms": duration_ms,
        "message": f"Refreshed {MV_NAME} in {duration_ms}ms",
    }


@router.post("/model_drafts/refresh")
async def refresh_model_drafts(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the model_drafts_mv materialized view."""
    try:
        result = await refresh_model_drafts_internal(conn)
        response.headers["X-Cache-Tags"] = "entries,model_drafts"
        return result
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_model_drafts",
            request=http_request,
        )
