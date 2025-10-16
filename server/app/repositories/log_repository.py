"""Log repository - thin wrapper around service."""

import asyncpg
from app.schemas.logs import (CreateLogRequest, CreateLogResponse,
                              LogsListRequest, LogsListResponse)
from app.services.log_service import LogService


class LogRepository:
    """Repository for log operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize repository with database connection."""
        self.service = LogService(conn)

    async def get_logs_list(
        self, request: LogsListRequest
    ) -> LogsListResponse:
        """Get list of logs."""
        return await self.service.get_logs_list(request)

    async def create_log(
        self, request: CreateLogRequest
    ) -> CreateLogResponse:
        """Create a new log entry."""
        return await self.service.create_log(request)


def get_log_repository(conn: asyncpg.Connection) -> LogRepository:
    """Get log repository instance."""
    return LogRepository(conn)
