"""Log v2 API endpoints."""

from app.db import get_session
from app.repositories.log_repository import LogRepository
from app.schemas.logs import (CreateLogRequest, CreateLogResponse,
                              LogsListRequest, LogsListResponse)
from app.services.log_service import LogService
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.post("/list", response_model=LogsListResponse)
async def list_logs(
    request: LogsListRequest,
    session: AsyncSession = Depends(get_session),
) -> LogsListResponse:
    """Get list of logs with actor information and all JSONB fields."""
    repo = LogRepository()
    return await repo.get_logs_list(request, session)


@router.post("/create", response_model=CreateLogResponse)
async def create_log(
    request: CreateLogRequest,
    session: AsyncSession = Depends(get_session),
) -> CreateLogResponse:
    """Create a new log entry."""
    try:
        service = LogService()
        return await service.create_log(request, session)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create log: {str(e)}")

