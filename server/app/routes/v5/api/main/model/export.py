"""Model export endpoint — composable infra architecture."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from redis.asyncio import Redis

from app.infra.globals import get_db, get_redis_client
from app.infra.model_export import export_model_client
from app.routes.v5.api.main.model.types import ExportModelApiResponse

router = APIRouter()


class ExportModelApiRequest(BaseModel):
    """Request model for model export."""

    model_id: UUID | None = None


@router.post("/export", response_model=ExportModelApiResponse)
async def export_models(
    body: ExportModelApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis_client)],
) -> ExportModelApiResponse:
    """Export all models as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_model_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        model_id=body.model_id,
    )
