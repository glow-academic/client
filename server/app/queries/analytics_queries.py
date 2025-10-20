"""Analytics utility queries - refresh materialized view."""


class AnalyticsQueries:
    """Query builders for analytics utilities."""

    @staticmethod
    def refresh_materialized_view() -> str:
        """Build query to refresh the analytics materialized view."""
        return "REFRESH MATERIALIZED VIEW CONCURRENTLY analytics"

