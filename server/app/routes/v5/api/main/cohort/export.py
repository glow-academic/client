"""Cohort export endpoint — composable infra architecture."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from redis.asyncio import Redis

from app.infra.cohort_export import export_cohort_client
from app.infra.globals import get_db, get_redis
from app.routes.v5.api.main.cohort.types import ExportCohortApiResponse

router = APIRouter()


class ExportCohortApiRequest(BaseModel):
    """Request model for cohort export."""

    cohort_id: UUID | None = None


@router.post("/export", response_model=ExportCohortApiResponse)
async def export_cohorts(
    body: ExportCohortApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> ExportCohortApiResponse:
    """Export all cohorts as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_cohort_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        cohort_id=body.cohort_id,
    )
