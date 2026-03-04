"""Refresh for benchmark materialized view."""

import time
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.benchmark.refresh import refresh_benchmark
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post("/benchmark/refresh")
async def refresh_benchmark_route(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> dict:
    """Refresh the benchmark_mv materialized view."""
    try:
        start_time = time.time()
        await refresh_benchmark(conn)
        duration_ms = int((time.time() - start_time) * 1000)
        response.headers["X-Cache-Tags"] = "entries,benchmark"
        return {
            "success": True,
            "duration_ms": duration_ms,
            "message": f"Refreshed benchmark_mv in {duration_ms}ms",
        }
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="refresh_benchmark",
            request=http_request,
        )
