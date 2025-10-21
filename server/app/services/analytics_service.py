"""Analytics service layer - utility operations for analytics infrastructure."""

import asyncpg  # type: ignore

from app.cache import keys
from app.queries.analytics_queries import AnalyticsQueries
from app.services.base_service import BaseService


class AnalyticsService(BaseService):
    """Service layer for analytics utility operations."""

    def __init__(self, conn: asyncpg.Connection) -> None:
        """Initialize service with database connection."""
        super().__init__(conn)
        self.queries = AnalyticsQueries()

    async def refresh_materialized_view(self) -> None:
        """Refresh the analytics materialized view and invalidate all analytics caches."""
        query = self.queries.refresh_materialized_view()
        await self.conn.execute(query)

        # Invalidate all analytics caches since the materialized view data has changed
        await self._invalidate_cache([keys.tag_analytics_all()])


def get_analytics_service(conn: asyncpg.Connection) -> AnalyticsService:
    """Get analytics service instance."""
    return AnalyticsService(conn)
