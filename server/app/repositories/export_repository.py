"""Export repository - thin wrapper around service."""

import asyncpg  # type: ignore
from app.services.export_service import ExportService


class ExportRepository:
    """Repository for export operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize repository with database connection."""
        self.service = ExportService(conn)

    async def export_to_csv(self, sql: str, max_rows: int = 1000) -> str:
        """Export query results to CSV file."""
        return await self.service.export_to_csv(sql, max_rows)


def get_export_repository(conn: asyncpg.Connection) -> ExportRepository:
    """Get export repository instance."""
    return ExportRepository(conn)

