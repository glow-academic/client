"""Simulation export endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.globals import get_db, get_redis
from app.infra.simulation_export import export_simulation_client
from app.routes.v5.api.main.simulation.types import (
    ExportSimulationApiRequest,
    ExportSimulationApiResponse,
)

router = APIRouter()


@router.post("/export", response_model=ExportSimulationApiResponse)
async def export_simulations(
    body: ExportSimulationApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> ExportSimulationApiResponse:
    """Export all simulations as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_simulation_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        simulation_id=body.simulation_id,
    )
