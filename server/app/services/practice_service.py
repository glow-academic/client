"""Practice service layer - business logic for practice analytics operations."""

import json
from typing import Any

import asyncpg  # type: ignore
from app.queries.practice_queries import PracticeQueries
from app.schemas.analytics import AnalyticsFilters
from app.schemas.base import (ParameterItemMappingItem, ParameterMappingItem,
                              PersonaMappingItem, ScenarioMappingItem,
                              SimulationMappingItem)
from app.schemas.home import AttemptHistoryRow
from app.schemas.practice import PracticeOverviewResponse
from app.services.base_service import BaseService


class PracticeService(BaseService):
    """Service layer for practice analytics operations."""

    def __init__(self, conn: asyncpg.Connection) -> None:
        """Initialize service with database session."""
        super().__init__(conn)
        self.queries = PracticeQueries()

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

    async def get_practice_overview(
        self, filters: AnalyticsFilters
    ) -> PracticeOverviewResponse:
        """Get practice overview data with history and all entity mappings."""
        return await self._execute_get_practice_overview(filters)

    async def _execute_get_practice_overview(
        self, filters: AnalyticsFilters
    ) -> PracticeOverviewResponse:
        """Execute the actual practice overview query.
        
        Note: Practice uses simplified filters (profile_id and department_ids only).
        No cohort/role/date filtering for personal practice.
        """
        # Validate that profile_id is provided (required for practice)
        if not filters.profileId:
            raise ValueError("profileId is required for practice overview")
        
        # Get overview items with ONE query (simplified params)
        query, params = self.queries.practice_overview(
            profile_id=filters.profileId,
            department_ids=filters.departmentIds,
        )
        result = await self.conn.fetchval(query, *params)

        # Parse JSON string to dict if needed
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

        # Parse embedded persona mapping
        persona_mapping = {}
        if isinstance(parsed_result.get("persona_mapping"), dict):
            for persona_id, persona_data in parsed_result["persona_mapping"].items():
                if isinstance(persona_data, dict):
                    persona_mapping[persona_id] = PersonaMappingItem(
                        name=persona_data.get("name", ""),
                        description=persona_data.get("description", ""),
                        color=persona_data.get("color") or "",
                        icon=persona_data.get("icon") or "",
                        image_model=persona_data.get("image_model"),
                    )

        # Parse embedded scenario mapping
        scenario_mapping = {}
        if isinstance(parsed_result.get("scenario_mapping"), dict):
            for scenario_id, scenario_data in parsed_result["scenario_mapping"].items():
                if isinstance(scenario_data, dict):
                    # Parse persona_ids from data (may be array or single value for backward compatibility)
                    persona_ids = []
                    if scenario_data.get("persona_ids"):
                        persona_ids = scenario_data["persona_ids"] if isinstance(scenario_data["persona_ids"], list) else [scenario_data["persona_ids"]]
                    elif scenario_data.get("persona_id"):
                        # Backward compatibility: convert single persona_id to array
                        persona_ids = [str(scenario_data["persona_id"])]
                    
                    scenario_mapping[scenario_id] = ScenarioMappingItem(
                        name=scenario_data.get("name", ""),
                        description=scenario_data.get("description", ""),
                        persona_ids=persona_ids,
                        persona_mapping={},
                        document_mapping={},
                        parameter_item_mapping={},
                        parameter_item_ids=[],
                        document_ids=[],
                    )

        # Parse embedded parameter mapping
        parameter_mapping = {}
        if isinstance(parsed_result.get("parameter_mapping"), dict):
            for param_id, param_data in parsed_result["parameter_mapping"].items():
                if isinstance(param_data, dict):
                    parameter_mapping[param_id] = ParameterMappingItem(
                        name=param_data.get("name", ""),
                        description=param_data.get("description", ""),
                        numerical=param_data.get("numerical", False),
                    )

        # Parse embedded parameter_item mapping
        parameter_item_mapping = {}
        if isinstance(parsed_result.get("parameter_item_mapping"), dict):
            for item_id, item_data in parsed_result["parameter_item_mapping"].items():
                if isinstance(item_data, dict):
                    parameter_item_mapping[item_id] = ParameterItemMappingItem(
                        name=item_data.get("name", ""),
                        description=item_data.get("description", ""),
                        parameter_id=item_data.get("parameter_id", ""),
                        parameter_name=item_data.get("parameter_name", ""),
                        value=item_data.get("value", ""),
                    )

        return PracticeOverviewResponse(
            mode=parsed_result.get("mode", "practice"),
            hasData=parsed_result.get("hasData", False),
            items=parsed_result.get("items", []),
            history=history,
            standard_groups_mapping=parsed_result.get("standard_groups_mapping", {}),
            standards_mapping=parsed_result.get("standards_mapping", {}),
            simulation_mapping=simulation_mapping,
            persona_mapping=persona_mapping,
            scenario_mapping=scenario_mapping,
            parameter_mapping=parameter_mapping,
            parameter_item_mapping=parameter_item_mapping,
        )


def get_practice_service(conn: asyncpg.Connection) -> PracticeService:
    """Get practice service instance."""
    return PracticeService(conn)
