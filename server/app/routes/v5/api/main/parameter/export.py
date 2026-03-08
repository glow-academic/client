"""Parameter export endpoint — composable infra architecture."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from redis.asyncio import Redis

from app.infra.globals import get_db, get_redis
from app.infra.parameter_export import export_parameter_client
from app.routes.v5.api.main.parameter.types import ExportParameterApiResponse

router = APIRouter()


class ExportParameterApiRequest(BaseModel):
    """Request model for parameter export."""

    parameter_id: UUID | None = None


@router.post("/export", response_model=ExportParameterApiResponse)
async def export_parameters(
    body: ExportParameterApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> ExportParameterApiResponse:
    """Export all parameters as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_parameter_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        parameter_id=body.parameter_id,
    )
