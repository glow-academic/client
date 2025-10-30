"""Home service layer - business logic for home overview analytics."""

import json
from typing import Any

import asyncpg  # type: ignore
from app.queries.base_queries import AnalyticsQueryBuilder
from app.queries.home_queries import HomeQueries
from app.schemas.analytics import AnalyticsFilters
from app.schemas.base import SimulationMappingItem
from app.schemas.home import AttemptHistoryRow, HomeOverviewResponse
from app.services.base_service import BaseService


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

        Mode logic (determined in SQL):
        - If role is 'ta' → TA mode (personalized view with profileId filter for items + history)
        - Otherwise → Instructional mode (all cohort data for items, profileId filter for history only)
        """
        # Resolve "guest-profile-id" to actual default guest profile
        profile_id = filters.profileId
        if profile_id == "guest-profile-id":
            from app.services.profile_service import ProfileService
            profile_service = ProfileService(self.conn)
            guest_id = await profile_service.get_default_guest_profile_id()
            if guest_id:
                profile_id = str(guest_id)
            else:
                raise ValueError("No default guest profile found in database")

        # Execute single query - it looks up the role and determines view mode internally
        # Note: Home always shows general simulations only (hardcoded in query, no role filter)
        query, params = self.queries.home_overview(
            start_date=filters.startDate,
            end_date=filters.endDate,
            cohort_ids=filters.cohortIds,
            profile_id=profile_id,
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
                    # Handle department_ids - may be array or null
                    dept_ids = sim_data.get("department_ids")
                    if isinstance(dept_ids, str):
                        # Handle case where it's a JSON string
                        import json
                        try:
                            dept_ids = json.loads(dept_ids)
                        except (json.JSONDecodeError, ValueError):
                            dept_ids = [dept_ids] if dept_ids else None
                    elif dept_ids is None:
                        dept_ids = None
                    elif not isinstance(dept_ids, list):
                        dept_ids = [dept_ids] if dept_ids else None
                    
                    simulation_mapping[sim_id] = SimulationMappingItem(
                        name=sim_data.get("name", ""),
                        description=sim_data.get("description", ""),
                        time_limit=sim_data.get("time_limit"),
                        department_ids=dept_ids,
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
