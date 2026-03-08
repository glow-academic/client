"""Department export endpoint — composable infra architecture."""

from typing import Annotated
from uuid import UUID

import asyncpg
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel
from redis.asyncio import Redis

from app.infra.department_export import export_department_client
from app.infra.globals import get_db, get_redis
from app.routes.v5.api.main.department.types import ExportDepartmentApiResponse

router = APIRouter()


class ExportDepartmentApiRequest(BaseModel):
    """Request model for department export."""

    department_id: UUID | None = None


@router.post("/export", response_model=ExportDepartmentApiResponse)
async def export_departments(
    body: ExportDepartmentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    redis: Annotated[Redis, Depends(get_redis)],
) -> ExportDepartmentApiResponse:
    """Export all departments as a clean, denormalized CSV."""
    profile_id = http_request.state.profile_id
    session_id = http_request.state.session_id

    return await export_department_client(
        conn,
        redis,
        profile_id=profile_id,
        session_id=session_id,
        department_id=body.department_id,
    )
