"""Log repository - thin wrapper around service."""

from app.schemas.logs import LogsListRequest, LogsListResponse
from app.services.log_service import LogService
from sqlalchemy.ext.asyncio import AsyncSession


class LogRepository:
    """Repository for log operations."""

    def __init__(self) -> None:
        """Initialize repository with service."""
        self.service = LogService()

    async def get_logs_list(
        self, request: LogsListRequest, session: AsyncSession
    ) -> LogsListResponse:
        """Get list of logs."""
        return await self.service.get_logs_list(request, session)

