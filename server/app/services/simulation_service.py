"""Simulation service layer - business logic for simulation operations."""

import json
from datetime import UTC
from typing import Any

import asyncpg  # type: ignore
from app.cache import keys
from app.db import transaction
from app.queries.simulation_queries import SimulationQueries
from app.schemas.base import (DepartmentMappingItem, ParameterItemMapping,
                              ParameterItemMappingItem, ParameterMapping,
                              ParameterMappingItem, RubricMapping,
                              RubricMappingItem, ScenarioMappingItem)
from app.schemas.simulations import (CreateSimulationRequest,
                                     CreateSimulationResponse,
                                     DeleteSimulationRequest,
                                     DeleteSimulationResponse,
                                     DuplicateSimulationRequest,
                                     DuplicateSimulationResponse,
                                     ParameterItem, ParameterItemDetail,
                                     ScenarioInSimulation,
                                     SimulationDetailDefaultRequest,
                                     SimulationDetailRequest,
                                     SimulationDetailResponse, SimulationItem,
                                     SimulationsFilters,
                                     SimulationsListResponse,
                                     UpdateSimulationRequest,
                                     UpdateSimulationResponse)
from app.services.base_service import BaseService, with_cache
from app.utils.search import build_fuzzy_conditions, normalize_text, tokenize


class SimulationService(BaseService):
    """Service layer for simulation operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database session."""
        super().__init__(conn)
        self.queries = SimulationQueries()

    @with_cache(lambda self, filters: keys.simulation_list(filters))
    async def get_simulations_list(
        self, filters: SimulationsFilters
    ) -> SimulationsListResponse:
        """Get simulations list with permissions using dynamic SQL."""
        return await self._execute_get_simulations_list(filters)

    async def _execute_get_simulations_list(
        self, filters: SimulationsFilters
    ) -> SimulationsListResponse:
        """Execute simulations list query (extracted for caching)."""
        # Get query from query builder
        query, params = self.queries.list_simulations(
            filters.departmentIds, filters.profileId
        )

        result = await self.conn.fetch(query, *params)

        # Build response
        simulations = []
        scenario_mapping: dict[str, ScenarioMappingItem] = {}
        rubric_mapping: RubricMapping = {}

        # Parse scenario_mapping and rubric_mapping from first row (same across all rows)
        if result:
            first_row = result[0]

            # Parse scenario mapping from JSONB with type safety (may be string or dict)
            scenario_mapping_data = first_row.get("scenario_mapping")
            if isinstance(scenario_mapping_data, str):
                scenario_mapping_data = json.loads(scenario_mapping_data)
            if scenario_mapping_data and isinstance(scenario_mapping_data, dict):
                for sid, sdata in scenario_mapping_data.items():
                    if isinstance(sdata, dict):
                        scenario_mapping[sid] = ScenarioMappingItem(
                            name=sdata.get("name", ""),
                            description=sdata.get("description", ""),
                            persona_id=str(sdata["persona_id"])
                            if sdata.get("persona_id")
                            else None,
                            persona_mapping=sdata.get("persona_mapping", {}),
                            document_mapping=sdata.get("document_mapping", {}),
                            parameter_item_mapping=sdata.get(
                                "parameter_item_mapping", {}
                            ),
                            parameter_item_ids=sdata.get("parameter_item_ids", []),
                            document_ids=sdata.get("document_ids", []),
                        )

            # Parse rubric mapping from JSONB with type safety (may be string or dict)
            rubric_mapping_data = first_row.get("rubric_mapping")
            if isinstance(rubric_mapping_data, str):
                rubric_mapping_data = json.loads(rubric_mapping_data)
            if rubric_mapping_data and isinstance(rubric_mapping_data, dict):
                for rid, rdata in rubric_mapping_data.items():
                    if isinstance(rdata, dict):
                        rubric_mapping[rid] = RubricMappingItem(
                            name=rdata.get("name", ""),
                            description=rdata.get("description", ""),
                        )

        # Build simulation items
        for row in result:
            # Convert UUID arrays to string arrays
            scenario_ids = [str(sid) for sid in (row["scenario_ids"] or [])]

            simulations.append(
                SimulationItem(
                    simulation_id=str(row["simulation_id"]),
                    name=row["name"],
                    description=row["description"],
                    time_limit=row["time_limit"],
                    active=row["active"],
                    default_simulation=row["default_simulation"],
                    practice_simulation=row["practice_simulation"],
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                    scenario_ids=scenario_ids,
                    rubric_id=str(row["rubric_id"]),
                    num_cohorts=row["num_cohorts"],
                )
            )

        return SimulationsListResponse(
            simulations=simulations,
            scenario_mapping=scenario_mapping,
            rubric_mapping=rubric_mapping,
        )

    @with_cache(
        lambda self, request: keys.simulation_by_id(
            request.simulationId, request.profileId
        )
    )
    async def get_simulation_detail(
        self, request: SimulationDetailRequest
    ) -> SimulationDetailResponse:
        """Get detailed simulation information using dynamic SQL."""
        return await self._execute_get_simulation_detail(request)

    async def _execute_get_simulation_detail(
        self, request: SimulationDetailRequest
    ) -> SimulationDetailResponse:
        """Execute simulation detail query (extracted for caching).

        OPTIMIZED: Uses single query instead of ~16 queries.
        """
        # Get all data in ONE query using CTEs and JSONB aggregations
        query, params = self.queries.get_simulation_detail_complete(
            request.simulationId, request.profileId
        )
        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError(f"Simulation not found: {request.simulationId}")

        # Extract user role and cohort count for permissions
        user_role = result["user_role"] if result.get("user_role") else "trainee"
        cohort_count = result.get("cohort_count", 0)
        in_use = cohort_count > 0

        # Compute permissions
        is_admin = user_role in ("admin", "superadmin")
        can_edit = is_admin and (
            not result["default_simulation"] or user_role == "superadmin"
        )
        can_duplicate = is_admin
        can_delete = is_admin and not in_use

        # Parse scenarios list from JSONB with type safety (may be string or list)
        scenarios_list: list[ScenarioInSimulation] = []
        scenarios_list_data = result.get("scenarios_list")
        if isinstance(scenarios_list_data, str):
            scenarios_list_data = json.loads(scenarios_list_data)
        if scenarios_list_data and isinstance(scenarios_list_data, list):
            for s_data in scenarios_list_data:
                if isinstance(s_data, dict):
                    scenarios_list.append(
                        ScenarioInSimulation(
                            scenario_id=s_data.get("scenario_id", ""),
                            title=s_data.get("title", ""),
                            description=s_data.get("description", ""),
                            active=s_data.get("active", False),
                            default_scenario=s_data.get("default_scenario", False),
                            position=s_data.get("position", 0),
                            parameter_item_ids=s_data.get("parameter_item_ids", []),
                            usage_count=s_data.get("usage_count", 0),
                            success_rate=s_data.get("success_rate", 0),
                            last_used=s_data.get("last_used"),
                            can_remove=s_data.get("can_remove", True),
                        )
                    )

        # Get scenario IDs and valid IDs
        scenario_ids = result.get("scenario_ids", [])
        valid_scenario_ids = result.get("valid_scenario_ids", [])
        valid_rubric_ids = result.get("valid_rubric_ids", [])
        valid_department_ids = result.get("valid_department_ids", [])

        # Parse rubric mapping from JSONB with type safety (may be string or dict)
        rubric_mapping: RubricMapping = {}
        rubric_mapping_data = result.get("rubric_mapping")
        if isinstance(rubric_mapping_data, str):
            rubric_mapping_data = json.loads(rubric_mapping_data)
        if rubric_mapping_data and isinstance(rubric_mapping_data, dict):
            for rid, rdata in rubric_mapping_data.items():
                if isinstance(rdata, dict):
                    rubric_mapping[rid] = RubricMappingItem(
                        name=rdata.get("name", ""),
                        description=rdata.get("description", ""),
                    )

        # Parse scenario mapping from JSONB with type safety (may be string or dict)
        scenario_mapping: dict[str, ScenarioMappingItem] = {}
        scenario_mapping_data = result.get("scenario_mapping")
        if isinstance(scenario_mapping_data, str):
            scenario_mapping_data = json.loads(scenario_mapping_data)
        if scenario_mapping_data and isinstance(scenario_mapping_data, dict):
            for sid, sdata in scenario_mapping_data.items():
                if isinstance(sdata, dict):
                    # Parse nested persona mapping
                    persona_mapping = {}
                    if sdata.get("persona_mapping") and isinstance(
                        sdata["persona_mapping"], dict
                    ):
                        for pid, pdata in sdata["persona_mapping"].items():
                            if isinstance(pdata, dict):
                                from app.schemas.base import PersonaMappingItem

                                persona_mapping[pid] = PersonaMappingItem(
                                    name=pdata.get("name", ""),
                                    description=pdata.get("description", ""),
                                    color=pdata.get("color", ""),
                                    icon=pdata.get("icon", ""),
                                )

                    # Parse nested document mapping
                    document_mapping = {}
                    if sdata.get("document_mapping") and isinstance(
                        sdata["document_mapping"], dict
                    ):
                        for did, ddata in sdata["document_mapping"].items():
                            if isinstance(ddata, dict):
                                from app.schemas.base import \
                                    DocumentMappingItem

                                document_mapping[did] = DocumentMappingItem(
                                    name=ddata.get("name", ""),
                                    description=ddata.get("description", ""),
                                )

                    # Parse nested parameter_item mapping
                    param_item_mapping = {}
                    if sdata.get("parameter_item_mapping") and isinstance(
                        sdata["parameter_item_mapping"], dict
                    ):
                        for piid, pidata in sdata["parameter_item_mapping"].items():
                            if isinstance(pidata, dict):
                                param_item_mapping[piid] = ParameterItemMappingItem(
                                    name=pidata.get("name", ""),
                                    description=pidata.get("description", ""),
                                    parameter_id=pidata.get("parameter_id", ""),
                                    parameter_name=pidata.get("parameter_name", ""),
                                )

                    scenario_mapping[sid] = ScenarioMappingItem(
                        name=sdata.get("name", ""),
                        description=sdata.get("description", ""),
                        persona_id=sdata.get("persona_id"),
                        persona_mapping=persona_mapping,
                        document_mapping=document_mapping,
                        parameter_item_mapping=param_item_mapping,
                        parameter_item_ids=sdata.get("parameter_item_ids", []),
                        document_ids=sdata.get("document_ids", []),
                    )

        # Parse department mapping from JSONB with type safety
        department_mapping: dict[str, DepartmentMappingItem] = {}
        if result.get("department_mapping") and isinstance(
            result["department_mapping"], dict
        ):
            for did, ddata in result["department_mapping"].items():
                if isinstance(ddata, dict):
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Parse parameter mapping from JSONB with type safety
        parameter_mapping: ParameterMapping = {}
        if result.get("parameter_mapping") and isinstance(
            result["parameter_mapping"], dict
        ):
            for pid, pdata in result["parameter_mapping"].items():
                if isinstance(pdata, dict):
                    parameter_mapping[pid] = ParameterMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                    )

        # Parse parameter_item mapping from JSONB with type safety
        parameter_item_mapping: ParameterItemMapping = {}
        if result.get("parameter_item_mapping") and isinstance(
            result["parameter_item_mapping"], dict
        ):
            for piid, pidata in result["parameter_item_mapping"].items():
                if isinstance(pidata, dict):
                    parameter_item_mapping[piid] = ParameterItemMappingItem(
                        name=pidata.get("name", ""),
                        description=pidata.get("description", ""),
                        parameter_id=pidata.get("parameter_id", ""),
                        parameter_name=pidata.get("parameter_name", ""),
                    )

        # Parse parameter items list from JSONB with type safety
        parameters_list: list[ParameterItem] = []
        parameter_items_list: list[ParameterItemDetail] = []
        if result.get("parameter_items_list") and isinstance(
            result["parameter_items_list"], list
        ):
            for pi_data in result["parameter_items_list"]:
                if isinstance(pi_data, dict):
                    parameter_items_list.append(
                        ParameterItemDetail(
                            id=pi_data.get("id", ""),
                            name=pi_data.get("name", ""),
                            description=pi_data.get("description"),
                            parameter_id=pi_data.get("parameter_id", ""),
                        )
                    )
                    parameters_list.append(
                        ParameterItem(
                            id=pi_data.get("id", ""),
                            parameter_id=pi_data.get("parameter_id", ""),
                            name=pi_data.get("name", ""),
                            description=pi_data.get("description"),
                        )
                    )

        return SimulationDetailResponse(
            # Basic fields
            name=result["title"],
            description=result["description"],
            department_id=result["department_id"],
            valid_department_ids=valid_department_ids,
            time_limit=result["time_limit"],
            rubric_id=result["rubric_id"],
            valid_rubric_ids=valid_rubric_ids,
            scenario_ids=scenario_ids,
            valid_scenario_ids=valid_scenario_ids,
            # Boolean parameters
            active=result["active"],
            default_simulation=result["default_simulation"],
            practice_simulation=result["practice_simulation"],
            hints_enabled=result["hints_enabled"],
            input_guardrail_active=result["input_guardrail_active"],
            output_guardrail_active=result["output_guardrail_active"],
            image_input_active=result["image_input_active"],
            # Permission flags
            can_edit=can_edit,
            can_duplicate=can_duplicate,
            can_delete=can_delete,
            # Usage status
            in_use=in_use,
            cohort_count=cohort_count,
            # Full scenario objects
            scenarios=scenarios_list,
            # Parameter data
            parameters=parameters_list,
            parameter_items=parameter_items_list,
            parameter_mapping=parameter_mapping,
            # Mappings
            scenario_mapping=scenario_mapping,
            rubric_mapping=rubric_mapping,
            department_mapping=department_mapping,
            parameter_item_mapping=parameter_item_mapping,
        )

    async def get_simulation_detail_default(
        self, request: SimulationDetailDefaultRequest
    ) -> SimulationDetailResponse:
        """Get default simulation details based on profile."""
        # Use consolidated query that finds default and fetches detail in one go
        query, params = self.queries.get_simulation_detail_default_complete(
            request.profileId
        )
        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError("No simulations found for user's departments")

        # Extract user role and cohort count for permissions
        user_role = result["user_role"] if result.get("user_role") else "trainee"
        cohort_count = result.get("cohort_count", 0)
        in_use = cohort_count > 0

        # Compute permissions
        is_admin = user_role in ("admin", "superadmin")
        can_edit = is_admin and (
            not result["default_simulation"] or user_role == "superadmin"
        )
        can_duplicate = is_admin
        can_delete = is_admin and not in_use

        # Parse scenarios list from JSONB with type safety (may be string or list)
        scenarios_list: list[ScenarioInSimulation] = []
        scenarios_list_data = result.get("scenarios_list")
        if isinstance(scenarios_list_data, str):
            scenarios_list_data = json.loads(scenarios_list_data)
        if scenarios_list_data and isinstance(scenarios_list_data, list):
            for s_data in scenarios_list_data:
                if isinstance(s_data, dict):
                    scenarios_list.append(
                        ScenarioInSimulation(
                            scenario_id=s_data.get("scenario_id", ""),
                            title=s_data.get("title", ""),
                            description=s_data.get("description", ""),
                            active=s_data.get("active", True),
                            default_scenario=s_data.get("default_scenario", False),
                            position=s_data.get("position", 0),
                            parameter_item_ids=s_data.get("parameter_item_ids", []),
                            usage_count=s_data.get("usage_count", 0),
                            success_rate=s_data.get("success_rate", 0),
                            last_used=s_data.get("last_used"),
                            can_remove=s_data.get("can_remove", True),
                        )
                    )

        scenario_ids = result.get("scenario_ids", [])
        valid_scenario_ids = result.get("valid_scenario_ids", [])
        valid_rubric_ids = result.get("valid_rubric_ids", [])
        valid_department_ids = result.get("valid_department_ids", [])

        # Parse rubric mapping from JSONB with type safety (may be string or dict)
        rubric_mapping: RubricMapping = {}
        rubric_mapping_data = result.get("rubric_mapping")
        if isinstance(rubric_mapping_data, str):
            rubric_mapping_data = json.loads(rubric_mapping_data)
        if rubric_mapping_data and isinstance(rubric_mapping_data, dict):
            for rid, rdata in rubric_mapping_data.items():
                if isinstance(rdata, dict):
                    rubric_mapping[rid] = RubricMappingItem(
                        name=rdata.get("name", ""),
                        description=rdata.get("description", ""),
                    )

        # Parse scenario mapping from JSONB with type safety (may be string or dict)
        scenario_mapping: dict[str, ScenarioMappingItem] = {}
        scenario_mapping_data = result.get("scenario_mapping")
        if isinstance(scenario_mapping_data, str):
            scenario_mapping_data = json.loads(scenario_mapping_data)
        if scenario_mapping_data and isinstance(scenario_mapping_data, dict):
            for sid, sdata in scenario_mapping_data.items():
                if isinstance(sdata, dict):
                    # Parse nested persona mapping
                    persona_mapping = {}
                    if sdata.get("persona_mapping") and isinstance(
                        sdata["persona_mapping"], dict
                    ):
                        for pid, pdata in sdata["persona_mapping"].items():
                            if isinstance(pdata, dict):
                                from app.schemas.base import PersonaMappingItem

                                persona_mapping[pid] = PersonaMappingItem(
                                    name=pdata.get("name", ""),
                                    description=pdata.get("description", ""),
                                    color=pdata.get("color", ""),
                                    icon=pdata.get("icon", ""),
                                )

                    # Parse nested document mapping
                    document_mapping = {}
                    if sdata.get("document_mapping") and isinstance(
                        sdata["document_mapping"], dict
                    ):
                        for did, ddata in sdata["document_mapping"].items():
                            if isinstance(ddata, dict):
                                from app.schemas.base import \
                                    DocumentMappingItem

                                document_mapping[did] = DocumentMappingItem(
                                    name=ddata.get("name", ""),
                                    description=ddata.get("description", ""),
                                )

                    # Parse nested parameter_item mapping
                    param_item_mapping = {}
                    if sdata.get("parameter_item_mapping") and isinstance(
                        sdata["parameter_item_mapping"], dict
                    ):
                        for piid, pidata in sdata["parameter_item_mapping"].items():
                            if isinstance(pidata, dict):
                                param_item_mapping[piid] = ParameterItemMappingItem(
                                    name=pidata.get("name", ""),
                                    description=pidata.get("description", ""),
                                    parameter_id=pidata.get("parameter_id", ""),
                                    parameter_name=pidata.get("parameter_name", ""),
                                )

                    scenario_mapping[sid] = ScenarioMappingItem(
                        name=sdata.get("name", ""),
                        description=sdata.get("description", ""),
                        persona_id=sdata.get("persona_id"),
                        persona_mapping=persona_mapping,
                        document_mapping=document_mapping,
                        parameter_item_mapping=param_item_mapping,
                        parameter_item_ids=sdata.get("parameter_item_ids", []),
                        document_ids=sdata.get("document_ids", []),
                    )

        # Parse department mapping from JSONB with type safety
        department_mapping: dict[str, DepartmentMappingItem] = {}
        if result.get("department_mapping") and isinstance(
            result["department_mapping"], dict
        ):
            for did, ddata in result["department_mapping"].items():
                if isinstance(ddata, dict):
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        # Parse parameter mapping from JSONB with type safety
        parameter_mapping: ParameterMapping = {}
        if result.get("parameter_mapping") and isinstance(
            result["parameter_mapping"], dict
        ):
            for pid, pdata in result["parameter_mapping"].items():
                if isinstance(pdata, dict):
                    parameter_mapping[pid] = ParameterMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                    )

        # Parse parameter item mapping from JSONB with type safety
        parameter_item_mapping: ParameterItemMapping = {}
        if result.get("parameter_item_mapping") and isinstance(
            result["parameter_item_mapping"], dict
        ):
            for piid, pidata in result["parameter_item_mapping"].items():
                if isinstance(pidata, dict):
                    parameter_item_mapping[piid] = ParameterItemMappingItem(
                        name=pidata.get("name", ""),
                        description=pidata.get("description", ""),
                        parameter_id=pidata.get("parameter_id", ""),
                        parameter_name=pidata.get("parameter_name", ""),
                    )

        # Parse parameter items list from JSONB with type safety
        parameter_items_list: list[ParameterItemForSimulation] = []
        if result.get("parameter_items_list") and isinstance(
            result["parameter_items_list"], list
        ):
            for pi_data in result["parameter_items_list"]:
                if isinstance(pi_data, dict):
                    parameter_items_list.append(
                        ParameterItemForSimulation(
                            id=pi_data.get("id", ""),
                            parameter_id=pi_data.get("parameter_id", ""),
                            name=pi_data.get("name", ""),
                            description=pi_data.get("description", ""),
                        )
                    )

        return SimulationDetailResponse(
            name=result["title"],  # Schema uses 'name' but DB has 'title'
            description=result["description"],
            department_id=result["department_id"],
            time_limit=result.get("time_limit"),
            rubric_id=result.get("rubric_id"),
            active=result["active"],
            default_simulation=result["default_simulation"],
            practice_simulation=result["practice_simulation"],
            hints_enabled=result["hints_enabled"],
            input_guardrail_active=result["input_guardrail_active"],
            output_guardrail_active=result["output_guardrail_active"],
            image_input_active=result["image_input_active"],
            can_edit=can_edit,
            can_duplicate=can_duplicate,
            can_delete=can_delete,
            in_use=in_use,
            cohort_count=cohort_count,
            scenarios=scenarios_list,
            scenario_ids=scenario_ids,
            valid_scenario_ids=valid_scenario_ids,
            valid_rubric_ids=valid_rubric_ids,
            valid_department_ids=valid_department_ids,
            parameters=[],  # Empty list for now
            parameter_items=parameter_items_list,
            parameter_mapping=parameter_mapping,
            scenario_mapping=scenario_mapping,
            rubric_mapping=rubric_mapping,
            department_mapping=department_mapping,
            parameter_item_mapping=parameter_item_mapping,
        )

    async def create_simulation(
        self, request: CreateSimulationRequest
    ) -> CreateSimulationResponse:
        """Create a new simulation using asyncpg."""

        async with transaction(self.conn):
            # Create simulation with positional params
            query = self.queries.create_simulation()
            result = await self.conn.fetchrow(
                query,
                request.title,
                request.description,
                request.department_id,
                request.active,
                request.default_simulation,
                request.practice_simulation,
                request.hints_enabled,
                request.input_guardrail_active,
                request.output_guardrail_active,
                request.image_input_active,
                request.rubric_id,
            )

            if not result:
                raise ValueError("Failed to create simulation")

            simulation_id = str(result["id"])

            # Insert time limit if provided (into junction table)
            if request.time_limit is not None:
                time_limit_query = self.queries.insert_simulation_time_limit()
                await self.conn.execute(
                    time_limit_query, simulation_id, request.time_limit
                )

            # Insert scenario relationships with active-first ordering
            insert_query = self.queries.insert_simulation_scenario()

            # Sort scenarios: active first, then inactive
            active_scenarios: list[tuple[str, bool]] = []
            inactive_scenarios: list[tuple[str, bool]] = []

            for scenario_item in request.scenario_ids:
                # Handle both string IDs and ScenarioInRequest objects
                scenario_id: str
                active: bool
                if isinstance(scenario_item, str):
                    scenario_id = scenario_item
                    active = True
                else:
                    # mypy: scenario_item is ScenarioInRequest here
                    scenario_id = scenario_item.scenario_id  # type: ignore
                    active = scenario_item.active  # type: ignore

                if active:
                    active_scenarios.append((scenario_id, active))
                else:
                    inactive_scenarios.append((scenario_id, active))

            # Combine: active first, then inactive
            sorted_scenarios = active_scenarios + inactive_scenarios

            # Insert with proper position indices (1-indexed)
            for idx, (scenario_id, active) in enumerate(sorted_scenarios, start=1):
                await self.conn.execute(
                    insert_query,
                    simulation_id,
                    scenario_id,
                    active,
                )

            # Invalidate affected caches
            await self._invalidate_cache(
                [
                    keys.tag_simulation_all(),
                    keys.tag_analytics_all(),
                ]
            )

            return CreateSimulationResponse(
                success=True,
                simulationId=simulation_id,
                message=f"Simulation '{request.title}' created successfully",
            )

    async def update_simulation(
        self, request: UpdateSimulationRequest
    ) -> UpdateSimulationResponse:
        """Update an existing simulation using asyncpg."""

        async with transaction(self.conn):
            # Check if simulation exists
            query, params = self.queries.get_simulation_name(request.simulationId)
            existing = await self.conn.fetchrow(query, *params)

            if not existing:
                raise ValueError(f"Simulation not found: {request.simulationId}")

            # Update simulation with positional params
            query = self.queries.update_simulation()
            await self.conn.execute(
                query,
                request.title,
                request.description,
                request.department_id,
                request.active,
                request.default_simulation,
                request.practice_simulation,
                request.hints_enabled,
                request.input_guardrail_active,
                request.output_guardrail_active,
                request.image_input_active,
                request.rubric_id,
                request.simulationId,
            )

            # Update time limit in junction table
            # First delete existing, then insert if provided
            delete_query, delete_params = self.queries.delete_simulation_time_limit(
                request.simulationId
            )
            await self.conn.execute(delete_query, *delete_params)

            if request.time_limit is not None:
                insert_query = self.queries.insert_simulation_time_limit()
                await self.conn.execute(
                    insert_query, request.simulationId, request.time_limit
                )

            # Delete existing scenarios
            query, params = self.queries.delete_simulation_scenarios(
                request.simulationId
            )
            await self.conn.execute(query, *params)

            # Insert new scenario relationships with active-first ordering
            insert_query = self.queries.insert_simulation_scenario()

            # Sort scenarios: active first, then inactive
            active_scenarios: list[tuple[str, bool]] = []
            inactive_scenarios: list[tuple[str, bool]] = []

            for scenario_item in request.scenario_ids:
                # Handle both string IDs and ScenarioInRequest objects
                scenario_id: str
                active: bool
                if isinstance(scenario_item, str):
                    scenario_id = scenario_item
                    active = True
                else:
                    # mypy: scenario_item is ScenarioInRequest here
                    scenario_id = scenario_item.scenario_id  # type: ignore
                    active = scenario_item.active  # type: ignore

                if active:
                    active_scenarios.append((scenario_id, active))
                else:
                    inactive_scenarios.append((scenario_id, active))

            # Combine: active first, then inactive
            sorted_scenarios = active_scenarios + inactive_scenarios

            # Insert with proper position indices (1-indexed)
            for idx, (scenario_id, active) in enumerate(sorted_scenarios, start=1):
                await self.conn.execute(
                    insert_query,
                    request.simulationId,
                    scenario_id,
                    active,
                )

            # Invalidate affected caches
            await self._invalidate_cache(
                [
                    keys.tag_simulation_by_id(request.simulationId),
                    keys.tag_simulation_all(),
                    keys.tag_analytics_all(),
                ]
            )

            return UpdateSimulationResponse(
                success=True,
                message=f"Simulation '{request.title}' updated successfully",
            )

    async def duplicate_simulation(
        self, request: DuplicateSimulationRequest
    ) -> DuplicateSimulationResponse:
        """Duplicate a simulation using asyncpg."""

        async with transaction(self.conn):
            # Get original simulation data
            query, params = self.queries.get_simulation_for_duplicate(
                request.simulationId
            )
            result = await self.conn.fetchrow(query, *params)

            if not result:
                raise ValueError(f"Simulation not found: {request.simulationId}")

            # Insert duplicate with positional params
            duplicate_query = self.queries.insert_duplicate_simulation()
            new_simulation = await self.conn.fetchrow(
                duplicate_query,
                result["title"],
                result["description"],
                result["department_id"],
                result["hints_enabled"],
                result["input_guardrail_active"],
                result["output_guardrail_active"],
                result["image_input_active"],
                result["rubric_id"],
            )

            if not new_simulation:
                raise ValueError("Failed to create duplicate simulation")

            new_simulation_id = str(new_simulation["id"])

            # Copy time limit if original has one
            get_limit_query, get_limit_params = self.queries.get_simulation_time_limit(
                request.simulationId
            )
            time_limit_result = await self.conn.fetchrow(
                get_limit_query, *get_limit_params
            )

            if time_limit_result:
                insert_limit_query = self.queries.insert_simulation_time_limit()
                await self.conn.execute(
                    insert_limit_query,
                    new_simulation_id,
                    time_limit_result["time_limit_seconds"],
                )

            # Copy simulation_scenarios relationships
            copy_query = self.queries.copy_simulation_scenarios()
            await self.conn.execute(
                copy_query,
                new_simulation["id"],
                request.simulationId,
            )

            # Invalidate affected caches
            await self._invalidate_cache(
                [
                    keys.tag_simulation_all(),
                    keys.tag_analytics_all(),
                ]
            )

            return DuplicateSimulationResponse(
                success=True,
                simulationId=str(new_simulation["id"]),
                message=f"Simulation '{result['title']}' duplicated successfully",
            )

    async def delete_simulation(
        self, request: DeleteSimulationRequest
    ) -> DeleteSimulationResponse:
        """Delete a simulation using asyncpg."""

        async with transaction(self.conn):
            # Check if simulation is in use
            query, params = self.queries.check_simulation_usage(request.simulationId)
            usage = await self.conn.fetchrow(query, *params)

            if not usage:
                raise ValueError("Failed to check simulation usage")

            if usage["usage_count"] > 0:
                raise ValueError("Cannot delete simulation that has attempts")

            # Get simulation name
            query, params = self.queries.get_simulation_name(request.simulationId)
            simulation = await self.conn.fetchrow(query, *params)

            if not simulation:
                raise ValueError(f"Simulation not found: {request.simulationId}")

            # Delete simulation
            query, params = self.queries.delete_simulation(request.simulationId)
            await self.conn.execute(query, *params)

            # Invalidate affected caches
            await self._invalidate_cache(
                [
                    keys.tag_simulation_by_id(request.simulationId),
                    keys.tag_simulation_all(),
                    keys.tag_analytics_all(),
                ]
            )

            return DeleteSimulationResponse(
                success=True,
                message=f"Simulation '{simulation['title']}' deleted successfully",
            )

    # ===== WebSocket Simulation Attempt Operations =====

    async def start_simulation_attempt(
        self,
        simulation_id: str,
        profile_id: str | None,
        scenario_id_override: str | None,
        infinite: bool,
        department_id: str,
    ) -> dict[str, Any]:
        """Create simulation attempt with all related entities using single query.

        Returns:
            {
                "attempt_id": UUID,
                "chat_id": UUID,
                "chat_title": str,
                "scenario": Dict
            }
        """
        import uuid as uuid_module

        from agents import gen_trace_id
        from app.agents.collection.scenario import run_scenario_agent

        # Use single consolidated query to get all data and create all records
        query, params = self.queries.start_simulation_attempt_complete(
            simulation_id, profile_id, scenario_id_override, infinite, department_id
        )
        result = await self.conn.fetchrow(query, *params)
        
        if not result:
            raise ValueError(f"Failed to start simulation {simulation_id}")

        # Extract data from query result
        attempt_id = result["attempt_id"]
        chat_id = result["chat_id"]
        chat_title = result["chat_title"]
        scenario_id = result["scenario_id"]
        scenario_name = result["scenario_name"]
        problem_statement = result["problem_statement"]
        needs_generation = result["needs_generation"]
        simulation_data = result["simulation_data"]
        scenario_metadata = result["scenario_metadata"]

        # Build scenario object from metadata
        scenario = {
            "id": scenario_id,
            "name": scenario_name,
            "problem_statement": problem_statement,
            "active": scenario_metadata["active"],
            "default_scenario": scenario_metadata["default_scenario"],
            "generated": scenario_metadata["generated"],
            "department_id": scenario_metadata["department_id"],
        }

        # Handle scenario generation if needed
        if needs_generation:
            # Extract metadata for agent call
            persona_id = scenario_metadata.get("persona_id")
            documents = scenario_metadata.get("documents", [])
            parameter_items = scenario_metadata.get("parameter_items", [])
            
            # Convert to expected formats
            doc_ids = [doc["id"] for doc in documents] if documents else []
            param_ids = [item["id"] for item in parameter_items] if parameter_items else []
            
            # Get profile from attempt
            query, params = self.queries.get_attempt_with_profile(attempt_id)
            attempt_with_profile = await self.conn.fetchrow(query, *params)
            attempt_profile_id = (
                attempt_with_profile["profile_id"] if attempt_with_profile else None
            )

            # Generate scenario content
            name, description, objectives, trace_id = await run_scenario_agent(
                department_id=uuid_module.UUID(department_id),
                persona_id=persona_id,
                document_ids=doc_ids,
                parameter_item_ids=param_ids,
                group_id=uuid_module.UUID(attempt_id),
                conn=self.conn,
                profile_id=attempt_profile_id,
            )
            
            # Update scenario with generated content
            scenario["name"] = name
            scenario["problem_statement"] = description
            chat_title = name
            
            # Update chat title in database
            query = self.queries.update_chat_title()
            await self.conn.execute(query, chat_id, name)
        else:
            # Use existing scenario data
            chat_title = scenario_name
            trace_id = gen_trace_id()

        return {
            "attempt_id": attempt_id,
            "chat_id": chat_id,
            "chat_title": chat_title,
            "scenario": scenario,
        }

    async def stop_simulation_run(self, chat_id: str) -> dict[str, Any]:
        """Stop active simulation run and mark incomplete message complete.

        Returns:
            {
                "success": bool,
                "cancelled_message_id": Optional[UUID],
                "final_content": str
            }
        """
        # Verify the chat exists
        query, params = self.queries.get_chat_by_id(chat_id)
        chat = await self.conn.fetchrow(query, *params)
        if not chat:
            raise ValueError("Chat not found")

        # Get incomplete response messages
        query, params = self.queries.get_incomplete_messages_for_chat(chat_id)
        assistant_msgs = await self.conn.fetch(query, *params)

        assistant_msg = assistant_msgs[0] if assistant_msgs else None

        if assistant_msg:
            # Mark as completed
            query = self.queries.update_message_completed()
            await self.conn.execute(query, assistant_msg["id"])

            return {
                "success": True,
                "cancelled_message_id": assistant_msg["id"],
                "final_content": assistant_msg["content"] or "",
            }
        else:
            return {
                "success": False,
                "cancelled_message_id": None,
                "final_content": "",
            }

    async def continue_simulation_attempt(
        self,
        chat_id: str,
        attempt_id: str,
        department_id: str,
        end_all: bool,
        sio_instance: Any = None,
    ) -> dict[str, Any]:
        """Complete current chat, create next chat, handle grading.

        Returns:
            {
                "completed_chat_id": UUID,
                "next_chat_id": Optional[UUID],
                "is_attempt_finished": bool,
                "simulation_grade_id": Optional[UUID],
                "created_chats_count": int
            }
        """
        from app.agents.collection.grade import run_grade_agent

        # Get the chat
        query, params = self.queries.get_chat_basic(chat_id)
        chat = await self.conn.fetchrow(query, *params)
        if not chat:
            raise ValueError("Chat not found")

        # Get the attempt
        query, params = self.queries.get_attempt_by_id(attempt_id)
        simulation_attempt = await self.conn.fetchrow(query, *params)
        if not simulation_attempt:
            raise ValueError("Attempt not found")

        # Get the simulation
        query, params = self.queries.get_simulation_by_id(
            str(simulation_attempt["simulation_id"])
        )
        simulation = await self.conn.fetchrow(query, *params)
        if not simulation:
            raise ValueError("Simulation not found")

        # Load scenarios for this simulation from junction table
        query, params = self.queries.get_simulation_scenarios_ordered(
            str(simulation["id"])
        )
        scenario_links = await self.conn.fetch(query, *params)
        is_infinite_mode = bool(simulation_attempt["infinite_mode"])

        # Get existing chats for this attempt
        query, params = self.queries.get_existing_chats_for_attempt(attempt_id)
        existing_chats = await self.conn.fetch(query, *params)
        next_index = len(existing_chats)

        # Create next chat if not end_all
        next_chat_id = chat_id
        if not end_all and scenario_links:
            next_scenario_id = None
            if is_infinite_mode:
                # Cycle through the configured scenarios indefinitely
                num_scenarios = len(scenario_links)
                if num_scenarios > 0:
                    cycling_index = next_index % num_scenarios
                    next_scenario_id = scenario_links[cycling_index]["scenario_id"]
            elif next_index < len(scenario_links):
                next_scenario_id = scenario_links[next_index]["scenario_id"]

            if next_scenario_id is not None:
                created_next_chat = await self._create_chat_for_scenario(
                    str(next_scenario_id),
                    attempt_id,
                    department_id,
                    mark_completed=False,
                )
                if created_next_chat is None:
                    raise ValueError("Next scenario not found")
                next_chat_id = created_next_chat["id"]

        # Grade the just-completed chat if it has at least 2 messages
        # Use optimized batch query to get message counts
        existing_chat_ids = [str(c["id"]) for c in existing_chats]
        query, params = self.queries.get_messages_count_by_chat_ids(existing_chat_ids)
        message_counts = await self.conn.fetch(query, *params)
        message_count_map = {
            str(row["chat_id"]): row["message_count"] for row in message_counts
        }

        simulation_grade_id = None
        chat_message_count = message_count_map.get(chat_id, 0)
        if chat_message_count >= 2:
            from uuid import UUID

            simulation_grade_id = await run_grade_agent(
                UUID(chat_id), UUID(department_id), self.conn, sio_instance
            )  # type: ignore

        # Mark the current chat as completed
        query, params = self.queries.update_chat_completed(chat_id)
        await self.conn.execute(query, *params)

        created_chats_count = 0
        if end_all:
            # End any other incomplete chats for this attempt
            for existing_chat in existing_chats:
                if not existing_chat["completed"] and existing_chat["id"] != chat_id:
                    other_message_count = message_count_map.get(
                        str(existing_chat["id"]), 0
                    )
                    if other_message_count >= 2:
                        from uuid import UUID

                        await run_grade_agent(
                            UUID(str(existing_chat["id"])),
                            UUID(department_id),
                            self.conn,
                            sio_instance,
                        )  # type: ignore
                    query, params = self.queries.update_chat_completed(
                        str(existing_chat["id"])
                    )
                    await self.conn.execute(query, *params)

            # Calculate and create remaining chats in order
            start_index = len(existing_chats)
            total_needed = max(0, len(scenario_links) - start_index)

            for offset in range(total_needed):
                next_id = scenario_links[start_index + offset]["scenario_id"]
                created = await self._create_chat_for_scenario(
                    str(next_id), attempt_id, department_id, mark_completed=True
                )
                if created is None:
                    break
                created_chats_count += 1

        is_attempt_finished = next_chat_id == chat_id

        # Invalidate analytics caches (grades affect analytics)
        await self._invalidate_cache(
            [
                keys.tag_analytics_all(),
            ]
        )

        return {
            "completed_chat_id": chat_id,
            "next_chat_id": next_chat_id,
            "is_attempt_finished": is_attempt_finished,
            "simulation_grade_id": simulation_grade_id,
            "created_chats_count": created_chats_count,
        }

    # ===== Message Operations =====

    async def create_user_message(self, chat_id: str, content: str) -> dict[str, Any]:
        """Create user message in chat.

        Returns: {"id": UUID, "created_at": datetime}
        """
        query = self.queries.create_message()
        result = await self.conn.fetchrow(query, chat_id, "query", content, True)
        return {"id": result["id"], "created_at": result["created_at"]}

    async def create_assistant_message_placeholder(
        self, chat_id: str
    ) -> dict[str, Any]:
        """Create empty assistant message for streaming.

        Returns: {"id": UUID, "created_at": datetime}
        """
        query = self.queries.create_message()
        result = await self.conn.fetchrow(query, chat_id, "response", "", False)
        return {"id": result["id"], "created_at": result["created_at"]}

    async def update_message_content(self, message_id: str, content: str) -> None:
        """Update message content during streaming."""
        query = self.queries.update_message_content()
        await self.conn.execute(query, content, message_id)

    async def complete_message(
        self, message_id: str, final_content: str | None = None
    ) -> None:
        """Mark message as completed, optionally updating content."""
        if final_content is not None:
            query = self.queries.update_message_content_and_completed()
            await self.conn.execute(query, final_content, message_id)
        else:
            query = self.queries.update_message_completed()
            await self.conn.execute(query, message_id)

    @with_cache(
        lambda self, chat_id: keys.simulation_for_chat(chat_id),
        fresh_ttl=10,
        stale_ttl=60,
    )
    async def get_simulation_for_chat(self, chat_id: str) -> dict[str, Any]:
        """Get simulation metadata from chat (optimized single JOIN query).

        Returns:
            {
                "simulation_id": UUID,
                "attempt_id": UUID,
                "practice_simulation": bool
            }
        """
        query, params = self.queries.get_simulation_metadata_for_chat(chat_id)
        result = await self.conn.fetchrow(query, *params)
        if not result:
            raise ValueError(f"Chat {chat_id} not found")

        return {
            "simulation_id": result["simulation_id"],
            "attempt_id": result["attempt_id"],
            "practice_simulation": result["practice_simulation"],
        }

    # ===== Private Helper Methods =====

    async def _create_chat_for_scenario(
        self,
        scenario_id: str,
        attempt_id: str,
        department_id: str,
        mark_completed: bool,
    ) -> dict[str, Any] | None:
        """Create chat for a scenario with full scenario preparation.

        This is a private helper used by continue_simulation_attempt.
        """
        from datetime import datetime

        from agents import gen_trace_id
        from app.agents.collection.scenario import run_scenario_agent

        query, params = self.queries.get_scenario_by_id(scenario_id)
        old_scenario = await self.conn.fetchrow(query, *params)
        if not old_scenario:
            return None

        # Randomly fill any null attributes
        import uuid as uuid_module

        # Create scenario service locally to avoid storing service dependencies
        from app.services.scenario_service import ScenarioService

        scenario_service = ScenarioService(self.conn)
        scenario = await scenario_service.randomly_fill_scenario_attributes(
            dict(old_scenario), uuid_module.UUID(department_id)
        )

        # Generate scenario problem_statement if empty
        if (
            not scenario.get("problem_statement")
            or scenario.get("problem_statement") == ""
        ):
            # Use optimized query to get all scenario metadata in one query
            query, params = self.queries.get_scenario_full_metadata(str(scenario["id"]))
            scenario_metadata = await self.conn.fetchrow(query, *params)

            doc_ids = (
                list(scenario_metadata["document_ids"])
                if scenario_metadata["document_ids"]
                else []
            )
            param_ids = (
                list(scenario_metadata["parameter_item_ids"])
                if scenario_metadata["parameter_item_ids"]
                else []
            )
            scenario_persona_id = scenario_metadata["persona_id"]

            # Get profile from attempt with optimized query
            query, params = self.queries.get_attempt_with_profile(attempt_id)
            attempt_with_profile = await self.conn.fetchrow(query, *params)
            attempt_profile_id = (
                attempt_with_profile["profile_id"] if attempt_with_profile else None
            )

            name, description, objectives, trace_id = await run_scenario_agent(
                department_id=scenario["department_id"],
                persona_id=scenario_persona_id,
                document_ids=doc_ids,
                parameter_item_ids=param_ids,
                group_id=uuid_module.UUID(attempt_id) if attempt_id else None,
                conn=self.conn,
                profile_id=attempt_profile_id,
            )
            scenario["name"] = name
            scenario["problem_statement"] = description
            chat_title = scenario["name"]
        else:
            chat_title = scenario["name"]
            trace_id = gen_trace_id()

        # Create chat
        query = self.queries.create_simulation_chat()
        chat = await self.conn.fetchrow(
            query,
            datetime.now(UTC),
            chat_title,
            scenario["id"],
            attempt_id,
            mark_completed,
            trace_id,
        )

        return dict(chat) if chat else None

    # ===== Analytics Methods for MCP Tools =====

    async def get_simulation_attempts(
        self, sim_id: str, limit: int = 200
    ) -> list[dict[str, Any]]:
        """Get flat list of attempts for a simulation.

        List all attempts (who, when, score) for a specific simulation.

        Args:
            sim_id: UUID string of the simulation
            limit: Max results (default: 200)

        Returns:
            List of attempt dicts with student info and grades
            or [{"error": "..."}] if error
        """
        try:
            simulation_uuid = __import__("uuid").UUID(sim_id)
        except ValueError:
            return [{"error": f"Invalid sim_id format: {sim_id}"}]

        return await self._get_simulation_attempts_cached(str(simulation_uuid), limit)

    @with_cache(
        lambda self, sim_id, limit: keys.simulation_attempts_list(sim_id, limit)
    )
    async def _get_simulation_attempts_cached(
        self, sim_id: str, limit: int
    ) -> list[dict[str, Any]]:
        """Get simulation attempts with caching."""
        return await self._execute_get_simulation_attempts(sim_id, limit)

    async def _execute_get_simulation_attempts(
        self, sim_id: str, limit: int
    ) -> list[dict[str, Any]]:
        """Execute simulation attempts query (extracted for caching)."""
        try:
            # Verify simulation exists
            query, params = self.queries.get_simulation_by_id(sim_id)
            simulation = await self.conn.fetchrow(query, *params)
            if not simulation:
                return [{"error": f"Simulation not found: {sim_id}"}]

            # Get all attempts for this simulation with student info and grades
            query, params = self.queries.get_simulation_attempts_list(sim_id, limit)
            attempts = await self.conn.fetch(query, *params)

            results = []
            for attempt in attempts:
                # Build student name
                student_name = "Unknown"
                if attempt["first_name"] or attempt["last_name"]:
                    name_parts = []
                    if attempt["first_name"]:
                        name_parts.append(attempt["first_name"])
                    if attempt["last_name"]:
                        name_parts.append(attempt["last_name"])
                    student_name = " ".join(name_parts)
                elif attempt["alias"]:
                    student_name = attempt["alias"]

                results.append(
                    {
                        "id": str(attempt["id"]),
                        "student": student_name,
                        "student_id": str(attempt["profile_id"])
                        if attempt["profile_id"]
                        else None,
                        "score": attempt["score"],
                        "passed": attempt["passed"],
                        "time_taken": attempt["time_taken"],
                        "created_at": attempt["created_at"].isoformat()
                        if attempt["created_at"]
                        else None,
                    }
                )

            return results

        except Exception as e:
            return [{"error": f"Database error: {str(e)}"}]

    # ===== Overview Methods for MCP Tools =====

    async def get_simulation_overview(self, sim_id: str) -> dict[str, Any]:
        """Get simulation overview with all related data in ONE optimized query.

        Returns simulation meta, rubric, cohorts, scenarios, and pass stats.

        Args:
            sim_id: UUID string of the simulation

        Returns:
            Dict with simulation overview data or {"error": "..."}
        """
        import uuid

        try:
            simulation_uuid = uuid.UUID(sim_id)
        except ValueError:
            return {"error": f"Invalid sim_id format: {sim_id}"}

        return await self._get_simulation_overview_cached(str(simulation_uuid))

    @with_cache(lambda self, sim_id: keys.simulation_overview(sim_id))
    async def _get_simulation_overview_cached(self, sim_id: str) -> dict[str, Any]:
        """Get simulation overview with caching."""
        return await self._execute_get_simulation_overview(sim_id)

    async def _execute_get_simulation_overview(self, sim_id: str) -> dict[str, Any]:
        """Execute simulation overview query (extracted for caching)."""
        import uuid

        try:
            query, params = self.queries.get_simulation_overview_complete(
                uuid.UUID(sim_id)
            )
            result = await self.conn.fetchrow(query, *params)

            if not result:
                return {"error": f"Simulation not found: {sim_id}"}

            # Transform JSON-aggregated data into response dict
            simulation_data = {
                "id": str(result["id"]),
                "title": result["title"],
                "active": result["active"],
                "time_limit": result["time_limit"],
                "created_at": result["created_at"].isoformat()
                if result["created_at"]
                else None,
            }

            # Transform rubric (jsonb object to dict)
            rubric_data = {}
            if result["rubric"] and result["rubric"].get("id"):
                rubric_data = {
                    "id": str(result["rubric"]["id"]),
                    "name": result["rubric"]["name"],
                    "description": result["rubric"]["description"],
                    "points": result["rubric"]["points"],
                    "pass_points": result["rubric"]["pass_points"],
                }

            # Transform cohorts (jsonb array to list of dicts)
            cohorts_data = []
            for cohort in result["cohorts"]:
                cohorts_data.append(
                    {
                        "id": str(cohort["id"]),
                        "title": cohort["title"],
                        "active": cohort["active"],
                    }
                )

            # Transform scenarios (jsonb array to list of dicts)
            scenarios_data = []
            for scenario in result["scenarios"]:
                scenarios_data.append(
                    {
                        "id": str(scenario["id"]),
                        "name": scenario["name"],
                        "problem_statement": scenario["problem_statement"],
                        "position": scenario["position"],
                    }
                )

            # Calculate pass rate
            pass_rate = 0.0
            if result["total_graded"] and result["total_graded"] > 0:
                pass_rate = round(
                    (result["total_passed"] / result["total_graded"]) * 100, 2
                )

            return {
                "simulation": simulation_data,
                "rubric": rubric_data,
                "cohorts": cohorts_data,
                "scenarios": scenarios_data,
                "stats": {
                    "total_attempts": result["total_attempts"],
                    "total_graded": result["total_graded"],
                    "pass_rate": pass_rate,
                },
            }

        except Exception as e:
            return {"error": f"Database error: {str(e)}"}

    async def search_simulations(
        self, query: str, limit: int = 10
    ) -> list[dict[str, Any]]:
        """
        Fuzzy search simulations by title.
        Returns scored and sorted results.

        Args:
            query: Search query string
            limit: Maximum number of results to return

        Returns:
            List of simulation dictionaries with scores
        """
        return await self._search_simulations_cached(query, limit)

    @with_cache(lambda self, query, limit: keys.simulation_search(query, limit))
    async def _search_simulations_cached(
        self, query: str, limit: int
    ) -> list[dict[str, Any]]:
        """Search simulations with caching."""
        return await self._execute_search_simulations(query, limit)

    async def _execute_search_simulations(
        self, query: str, limit: int
    ) -> list[dict[str, Any]]:
        """Execute simulation search query (extracted for caching)."""
        q_norm = normalize_text(query)
        if not q_norm:
            return []

        toks = tokenize(query)

        # Build fuzzy search conditions
        where_clause, params, param_idx = build_fuzzy_conditions(["s.title"], query)

        # Build and execute query
        query_template, _ = self.queries.search_simulations_fuzzy(
            where_clause, limit * 5
        )
        sql = query_template.replace("{param_count}", str(param_idx))
        params.append(limit * 5)  # Candidate pool

        sims = await self.conn.fetch(sql, *params)

        # Score and build results
        results = []
        for sim in sims:
            score = self._score_simulation(q_norm, toks, sim["title"])
            results.append(
                {
                    "id": str(sim["id"]),
                    "title": sim["title"],
                    "active": sim["active"],
                    "time_limit": sim["time_limit"],
                    "created_at": sim["created_at"].isoformat()
                    if sim["created_at"]
                    else None,
                    "score": score,
                }
            )

        results.sort(key=lambda r: (-r["score"], r["title"]))
        return results[:limit]

    def _score_simulation(self, q_norm: str, toks: list[str], title: str | None) -> int:
        """
        Score simulation relevance based on title matching.

        Args:
            q_norm: Normalized query string
            toks: Query tokens
            title: Simulation title

        Returns:
            Relevance score (higher is better)
        """
        t_norm = normalize_text(title or "")
        score = 0

        # Exact whole-title match
        if t_norm == q_norm:
            score += 100

        # Prefix (whole query)
        if t_norm.startswith(q_norm):
            score += 70

        # Per-token boosts
        for tok in toks:
            if t_norm.startswith(tok):
                score += 20
            if tok in t_norm:
                score += 10

        # Whole query appears somewhere
        if q_norm in t_norm:
            score += 5

        # Length proximity bonus (favor shorter / tighter match)
        gap = abs(len(t_norm) - len(q_norm))
        score += max(0, 10 - gap)

        return score


def get_simulation_service(conn: asyncpg.Connection) -> SimulationService:
    """Get simulation service instance."""
    return SimulationService(conn)
