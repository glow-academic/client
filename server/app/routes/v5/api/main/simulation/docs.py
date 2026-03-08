"""Simulation docs endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.docs.types import ComposedDocsResponse
from app.infra.globals import get_db, get_redis
from app.infra.simulation_docs import docs_simulation_client

router = APIRouter()


@router.post("/docs", response_model=ComposedDocsResponse)
async def get_simulation_docs_endpoint(
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> ComposedDocsResponse:
    """Get composed documentation for the simulation artifact."""
    profile_id = http_request.state.profile_id

    return await docs_simulation_client(
        conn,
        redis,
        profile_id=profile_id,
    )
