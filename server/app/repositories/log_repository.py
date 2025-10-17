"""Log repository - thin wrapper around service."""

from typing import Any, Dict, List

import asyncpg  # type: ignore
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

    async def get_recent_logs(
        self, level: str = "error", limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get recent application logs filtered by level."""
        return await self.service.get_recent_logs(level, limit)


def get_log_repository(conn: asyncpg.Connection) -> LogRepository:
    """Get log repository instance."""
    return LogRepository(conn)
