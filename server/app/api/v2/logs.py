"""Log v2 API endpoints."""

from typing import Annotated

import asyncpg
from app.db import get_db
from app.repositories.log_repository import get_log_repository
from app.schemas.logs import (CreateLogRequest, CreateLogResponse,
                              LogsListRequest, LogsListResponse)
from fastapi import APIRouter, Depends, HTTPException

router = APIRouter()


@router.post("/list", response_model=LogsListResponse)
async def list_logs(
    request: LogsListRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> LogsListResponse:
    """Get list of logs with actor information and all JSONB fields."""
    repo = get_log_repository(conn)
    return await repo.get_logs_list(request)


@router.post("/create", response_model=CreateLogResponse)
async def create_log(
    request: CreateLogRequest,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateLogResponse:
    """Create a new log entry."""
    try:
        repo = get_log_repository(conn)
        return await repo.create_log(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create log: {str(e)}")
