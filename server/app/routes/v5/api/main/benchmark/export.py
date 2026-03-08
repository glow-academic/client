"""Benchmark export endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.benchmark_export import export_benchmark_client
from app.infra.globals import get_db, get_redis
from app.routes.v5.api.main.benchmark.types import ExportBenchmarkApiResponse

router = APIRouter()


@router.post("/export", response_model=ExportBenchmarkApiResponse)
async def export_benchmark(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> ExportBenchmarkApiResponse:
    """Export all benchmark data as a clean, denormalized ZIP."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_benchmark_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
    )
