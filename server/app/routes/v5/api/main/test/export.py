"""Test export endpoint — composable infra architecture."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from redis.asyncio import Redis

from app.infra.globals import get_db, get_redis
from app.infra.test_export import export_test_client
from app.routes.v5.api.main.test.types import ExportTestApiResponse

router = APIRouter()


class ExportTestApiRequest(BaseModel):
    test_id: UUID


@router.post("/export", response_model=ExportTestApiResponse)
async def export_test(
    body: ExportTestApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> ExportTestApiResponse:
    """Export test data as a clean, denormalized ZIP."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_test_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        test_id=body.test_id,
    )
