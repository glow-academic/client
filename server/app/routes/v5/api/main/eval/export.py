"""Eval export endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.eval_export import export_eval_client
from app.infra.globals import get_db, get_redis
from app.routes.v5.api.main.eval.types import ExportEvalApiResponse

router = APIRouter()


@router.post("/export", response_model=ExportEvalApiResponse)
async def export_evals(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> ExportEvalApiResponse:
    """Export all evals as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_eval_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
    )
