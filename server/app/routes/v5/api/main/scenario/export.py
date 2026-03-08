"""Scenario export endpoint — composable infra architecture."""

from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from redis.asyncio import Redis

from app.infra.globals import get_db, get_redis_client
from app.infra.scenario_export import export_scenario_client
from app.routes.v5.api.main.scenario.types import (
    ExportScenarioApiRequest,
    ExportScenarioApiResponse,
)

router = APIRouter()


@router.post("/export", response_model=ExportScenarioApiResponse)
async def export_scenarios(
    body: ExportScenarioApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis_client)],
) -> ExportScenarioApiResponse:
    """Export all scenarios as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_scenario_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        scenario_id=body.scenario_id,
    )
