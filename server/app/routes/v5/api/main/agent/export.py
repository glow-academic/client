"""Agent export endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.agent_export import export_agent_client
from app.infra.globals import get_db, get_redis
from app.routes.v5.api.main.agent.types import (
    ExportAgentApiRequest,
    ExportAgentApiResponse,
)

router = APIRouter()


@router.post("/export", response_model=ExportAgentApiResponse)
async def export_agents(
    body: ExportAgentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> ExportAgentApiResponse:
    """Export all agents as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_agent_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        agent_id=body.agent_id,
    )
