"""Log v2 API endpoints (read-only)."""

from app.db import get_session
from app.repositories.log_repository import LogRepository
from app.schemas.logs import LogsListRequest, LogsListResponse
from fastapi import APIRouter, Depends
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

