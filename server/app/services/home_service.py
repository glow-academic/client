"""Home service layer - business logic for home overview analytics."""

import json
from typing import Any

import asyncpg  # type: ignore
from app.cache import keys
from app.queries.home_queries import HomeQueries
from app.schemas.analytics import AnalyticsFilters
from app.schemas.base import SimulationMappingItem
from app.schemas.home import AttemptHistoryRow, HomeOverviewResponse
from app.services.base import AnalyticsQueryBuilder, BaseService, with_cache


class HomeService(BaseService):
    """Service layer for home overview analytics operations."""

    def __init__(self, conn: asyncpg.Connection) -> None:
        """Initialize service with database connection."""
        super().__init__(conn)
        self.query_builder = AnalyticsQueryBuilder()
        self.queries = HomeQueries()

    def _parse_json_strings_recursive(self, obj: Any) -> Any:
        """
        Recursively parse JSON strings in nested structures.

        This handles cases where PostgreSQL json_agg returns JSON strings
        instead of parsed objects.
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

    @with_cache(lambda self, filters: keys.analytics_home_overview(filters))
    async def get_home_overview(
        self, filters: AnalyticsFilters
    ) -> HomeOverviewResponse:
        """
        Get home overview data with embedded history and mappings.

        ONE database query returns complete response including:
        - mode (ta/instructional/empty)
        - items (simulation list)
        - history (attempt history)
        - mappings (standard_groups, standards, simulations)
        """
        # Determine effective profile ID based on role
        # Admins, superadmins, and instructional staff see all data (no profile filter)
        effective_profile_id = None
        if filters.profileId:
            # Fetch profile role to determine if we should use profileId
            query, params = self.query_builder.get_profile_role(filters.profileId)
            role_row = await self.conn.fetchrow(query, *params)
            if role_row:
                role = role_row["role"]
                # Only use profileId for non-admin roles (ta, guest, etc.)
                if role not in ("admin", "superadmin", "instructional"):
                    effective_profile_id = filters.profileId

        # Execute single query to get all data
        query, params = self.queries.home_overview(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            roles=filters.roles,
            sim_filters=[f.value for f in filters.simulationFilters]
            if filters.simulationFilters
            else None,
            profile_id=effective_profile_id,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)

        # Parse JSON result recursively
        parsed_result = self._parse_json_strings_recursive(result or {})

        # Parse embedded history
        history = []
        if isinstance(parsed_result.get("history"), list):
            for row in parsed_result["history"]:
                if isinstance(row, dict):
                    history.append(AttemptHistoryRow.model_validate(row))

        # Parse embedded simulation mapping
        simulation_mapping = {}
        if isinstance(parsed_result.get("simulation_mapping"), dict):
            for sim_id, sim_data in parsed_result["simulation_mapping"].items():
                if isinstance(sim_data, dict):
                    simulation_mapping[sim_id] = SimulationMappingItem(
                        name=sim_data.get("name", ""),
                        description=sim_data.get("description", ""),
                    )

        return HomeOverviewResponse(
            mode=parsed_result.get("mode", "empty"),
            hasData=parsed_result.get("hasData", False),
            items=parsed_result.get("items", []),
            history=history,
            standard_groups_mapping=parsed_result.get("standard_groups_mapping", {}),
            standards_mapping=parsed_result.get("standards_mapping", {}),
            simulation_mapping=simulation_mapping,
        )
