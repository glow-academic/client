"""Leaderboard service layer - business logic for leaderboard analytics."""

import json
from typing import Any

import asyncpg  # type: ignore

from app.cache import keys
from app.queries.analytics.bundle_queries import BundleQueries
from app.schemas.analytics import AnalyticsFilters, LeaderboardBundleResponse
from app.services.base import BaseService, with_cache


class LeaderboardService(BaseService):
    """Service layer for leaderboard analytics operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database connection."""
        super().__init__(conn)
        self.bundle_queries = BundleQueries()

    @with_cache(lambda self, filters: keys.analytics_leaderboard_bundle(filters))
    async def get_leaderboard_bundle(
        self, filters: AnalyticsFilters
    ) -> LeaderboardBundleResponse:
        """Get leaderboard bundle with all metrics in ONE query.

        This consolidates all leaderboard metrics into a single response:
        - Total attempts per profile
        - Highest score average per profile
        - Messages per session per profile
        - Persona response times per profile
        - Time spent minutes per profile
        - Improvement rate per day per profile
        - Perfect score count per profile
        - Quickest pass minutes per profile

        Args:
            filters: AnalyticsFilters with date range, cohorts, roles, etc.

        Returns:
            LeaderboardBundleResponse with list of LeaderboardRow objects
        """
        return await self._execute_get_leaderboard_bundle(filters)

    async def _execute_get_leaderboard_bundle(
        self, filters: AnalyticsFilters
    ) -> LeaderboardBundleResponse:
        """Execute the actual leaderboard bundle query.

        Uses ONE optimized SQL query with CTEs and JSON aggregation to fetch
        all leaderboard metrics and profile data in a single database round-trip.
        """
        # Build query with all filters
        query, params = self.bundle_queries.leaderboard_bundle(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )

        # Execute query and get JSON result
        result = await self.conn.fetchval(query, *params)

        # Parse any JSON strings in nested structures
        parsed_result = self._parse_json_strings_recursive(result or {})

        # Validate and return response
        return LeaderboardBundleResponse.model_validate(parsed_result)

    def _parse_json_strings_recursive(self, obj: Any) -> Any:
        """Recursively parse JSON strings in nested structures.

        This handles cases where PostgreSQL json_agg returns JSON strings
        instead of parsed objects, particularly for trendData and dataPoints fields.
        """
        if isinstance(obj, str):
            # Try to parse as JSON
            try:
                return json.loads(obj)
            except (json.JSONDecodeError, ValueError):
                return obj
        elif isinstance(obj, dict):
            # Recursively process dictionary values
            return {k: self._parse_json_strings_recursive(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            # Recursively process list items
            return [self._parse_json_strings_recursive(item) for item in obj]
        else:
            return obj


def get_leaderboard_service(conn: asyncpg.Connection) -> LeaderboardService:
    """Get leaderboard service instance."""
    return LeaderboardService(conn)
