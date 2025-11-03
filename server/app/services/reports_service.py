"""Reports service layer - business logic for reports operations."""

import json

import asyncpg  # type: ignore
from app.cache import keys
from app.queries.reports_queries import ReportsQueries
from app.schemas.analytics import AnalyticsFilters
from app.schemas.base import (ScenarioMapping, ScenarioMappingItem,
                              SimulationMapping, SimulationMappingItem)
from app.schemas.reports import ReportsBundleResponse
from app.services.base_service import BaseService, with_cache


class ReportsService(BaseService):
    """Service layer for reports operations."""

    def __init__(self, conn: asyncpg.Connection) -> None:
        """Initialize service with database connection."""
        super().__init__(conn)
        self.queries = ReportsQueries()

    @with_cache(lambda self, filters: keys.analytics_reports_bundle(filters))
    async def get_reports_bundle(
        self, filters: AnalyticsFilters
    ) -> ReportsBundleResponse:
        """Get reports bundle data with entity mappings in ONE query."""
        return await self._execute_get_reports_bundle(filters)

    async def _execute_get_reports_bundle(
        self, filters: AnalyticsFilters
    ) -> ReportsBundleResponse:
        """Execute the actual reports bundle query."""
        # Build query with all filters
        query, params = self.queries.reports_bundle(
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

        # Execute single query
        result = await self.conn.fetchval(query, *params)

        # Parse JSONB result (may be string or dict)
        parsed_result = result or {}
        if isinstance(parsed_result, str):
            parsed_result = json.loads(parsed_result)

        # Extract data array
        bundle_data = parsed_result.get("data", []) if parsed_result else []

        # Parse scenario mapping from JSONB
        scenario_mapping: ScenarioMapping = {}
        scenario_mapping_data = parsed_result.get("scenario_mapping", {})
        if isinstance(scenario_mapping_data, str):
            scenario_mapping_data = json.loads(scenario_mapping_data)
        if scenario_mapping_data and isinstance(scenario_mapping_data, dict):
            for scenario_id, scenario_data in scenario_mapping_data.items():
                if isinstance(scenario_data, dict):
                    scenario_mapping[scenario_id] = ScenarioMappingItem(
                        name=scenario_data.get("name", ""),
                        description=scenario_data.get("description", ""),
                        persona_ids=[],
                        persona_mapping={},
                        document_mapping={},
                        parameter_item_mapping={},
                        parameter_item_ids=[],
                        document_ids=[],
                    )

        # Parse simulation mapping from JSONB
        simulation_mapping: SimulationMapping = {}
        simulation_mapping_data = parsed_result.get("simulation_mapping", {})
        if isinstance(simulation_mapping_data, str):
            simulation_mapping_data = json.loads(simulation_mapping_data)
        if simulation_mapping_data and isinstance(simulation_mapping_data, dict):
            for sim_id, sim_data in simulation_mapping_data.items():
                if isinstance(sim_data, dict):
                    simulation_mapping[sim_id] = SimulationMappingItem(
                        name=sim_data.get("name", ""),
                        description=sim_data.get("description", ""),
                        time_limit=sim_data.get("time_limit"),
                        department_ids=sim_data.get("department_ids"),
                    )

        return ReportsBundleResponse(
            data=bundle_data,
            scenario_mapping=scenario_mapping,
            simulation_mapping=simulation_mapping,
        )


def get_reports_service(conn: asyncpg.Connection) -> ReportsService:
    """Get reports service instance."""
    return ReportsService(conn)
