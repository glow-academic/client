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
            filters.profileId
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
                        # Parse persona_ids from data (may be array or single value for backward compatibility)
                        persona_ids = []
                        if sdata.get("persona_ids"):
                            persona_ids = sdata["persona_ids"] if isinstance(sdata["persona_ids"], list) else [sdata["persona_ids"]]
                        elif sdata.get("persona_id"):
                            # Backward compatibility: convert single persona_id to array
                            persona_ids = [str(sdata["persona_id"])]
                        
                        scenario_mapping[sid] = ScenarioMappingItem(
                            name=sdata.get("name", ""),
                            description=sdata.get("description", ""),
                            persona_ids=persona_ids,
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

        # Parse department_mapping from first row
        department_mapping: dict[str, DepartmentMappingItem] = {}
        if result:
            first_row = result[0]
            department_mapping_data = first_row.get("department_mapping")
            if isinstance(department_mapping_data, str):
                department_mapping_data = json.loads(department_mapping_data)
            if department_mapping_data and isinstance(department_mapping_data, dict):
                for did, ddata in department_mapping_data.items():
                    if isinstance(ddata, dict):
                        department_mapping[did] = DepartmentMappingItem(
                            name=ddata.get("name", ""),
                            description=ddata.get("description", ""),
                        )

        # Build simulation items
        for row in result:
            # Convert UUID arrays to string arrays
            scenario_ids = [str(sid) for sid in (row["scenario_ids"] or [])]
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            simulations.append(
                SimulationItem(
                    simulation_id=str(row["simulation_id"]),
                    name=row["name"],
                    description=row["description"],
                    department_ids=dept_ids,
                    time_limit=row["time_limit"],
                    active=row["active"],
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
            department_mapping=department_mapping,
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
        can_edit = is_admin
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
                                    image_model=pdata.get("image_model"),
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
                                    value=pidata.get("value", ""),
                                )

                    # Parse persona_ids from data (may be array or single value for backward compatibility)
                    persona_ids = []
                    if sdata.get("persona_ids"):
                        persona_ids = sdata["persona_ids"] if isinstance(sdata["persona_ids"], list) else [sdata["persona_ids"]]
                    elif sdata.get("persona_id"):
                        # Backward compatibility: convert single persona_id to array
                        persona_ids = [str(sdata["persona_id"])]
                    
                    scenario_mapping[sid] = ScenarioMappingItem(
                        name=sdata.get("name", ""),
                        description=sdata.get("description", ""),
                        persona_ids=persona_ids,
                        persona_mapping=persona_mapping,
                        document_mapping=document_mapping,
                        parameter_item_mapping=param_item_mapping,
                        parameter_item_ids=sdata.get("parameter_item_ids", []),
                        document_ids=sdata.get("document_ids", []),
                    )

        # Parse department mapping from JSONB with type safety (may be string or dict)
        department_mapping: dict[str, DepartmentMappingItem] = {}
        department_mapping_data = result.get("department_mapping")
        if isinstance(department_mapping_data, str):
            department_mapping_data = json.loads(department_mapping_data)
        if department_mapping_data and isinstance(department_mapping_data, dict):
            for did, ddata in department_mapping_data.items():
                if isinstance(ddata, dict):
                    # Parse optional ID arrays (handle None, empty arrays, or missing keys)
                    # Simulation form only needs: scenario_ids, rubric_ids, cohort_ids
                    dept_scenario_ids = ddata.get("scenario_ids")
                    dept_rubric_ids = ddata.get("rubric_ids")
                    dept_cohort_ids = ddata.get("cohort_ids")
                    
                    # Convert to list[str] if present, otherwise None
                    def to_str_list(value: Any) -> list[str] | None:
                        if value is None:
                            return None
                        if isinstance(value, list):
                            return [str(v) for v in value if v]
                        return None
                    
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                        scenario_ids=to_str_list(dept_scenario_ids),
                        rubric_ids=to_str_list(dept_rubric_ids),
                        cohort_ids=to_str_list(dept_cohort_ids),
                    )

        # Parse parameter mapping from JSONB with type safety (may be string or dict)
        parameter_mapping: ParameterMapping = {}
        parameter_mapping_data = result.get("parameter_mapping")
        if isinstance(parameter_mapping_data, str):
            parameter_mapping_data = json.loads(parameter_mapping_data)
        if parameter_mapping_data and isinstance(parameter_mapping_data, dict):
            for pid, pdata in parameter_mapping_data.items():
                if isinstance(pdata, dict):
                    parameter_mapping[pid] = ParameterMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                        numerical=pdata.get("numerical", False),
                        document_parameter=pdata.get("document_parameter", False),
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
                        value=pidata.get("value", ""),
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

        # Parse department_ids from query (None = cross-department)
        department_ids = result.get("department_ids")
        if department_ids:
            department_ids = [str(d) for d in department_ids]

        return SimulationDetailResponse(
            # Basic fields
            name=result["title"],
            description=result["description"],
            department_ids=department_ids,  # None or list of department IDs
            valid_department_ids=valid_department_ids,
            time_limit=result["time_limit"],
            rubric_id=result["rubric_id"],
            valid_rubric_ids=valid_rubric_ids,
            scenario_ids=scenario_ids,
            valid_scenario_ids=valid_scenario_ids,
            # Boolean parameters
            active=result["active"],
            practice_simulation=result["practice_simulation"],
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
        can_edit = is_admin
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
                                    image_model=pdata.get("image_model"),
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
                                    value=pidata.get("value", ""),
                                )

                    # Parse persona_ids from data (may be array or single value for backward compatibility)
                    persona_ids = []
                    if sdata.get("persona_ids"):
                        persona_ids = sdata["persona_ids"] if isinstance(sdata["persona_ids"], list) else [sdata["persona_ids"]]
                    elif sdata.get("persona_id"):
                        # Backward compatibility: convert single persona_id to array
                        persona_ids = [str(sdata["persona_id"])]
                    
                    scenario_mapping[sid] = ScenarioMappingItem(
                        name=sdata.get("name", ""),
                        description=sdata.get("description", ""),
                        persona_ids=persona_ids,
                        persona_mapping=persona_mapping,
                        document_mapping=document_mapping,
                        parameter_item_mapping=param_item_mapping,
                        parameter_item_ids=sdata.get("parameter_item_ids", []),
                        document_ids=sdata.get("document_ids", []),
                    )

        # Parse department mapping from JSONB with type safety (may be string or dict)
        department_mapping: dict[str, DepartmentMappingItem] = {}
        department_mapping_data = result.get("department_mapping")
        if isinstance(department_mapping_data, str):
            department_mapping_data = json.loads(department_mapping_data)
        if department_mapping_data and isinstance(department_mapping_data, dict):
            for did, ddata in department_mapping_data.items():
                if isinstance(ddata, dict):
                    # Parse optional ID arrays (handle None, empty arrays, or missing keys)
                    # Simulation form only needs: scenario_ids, rubric_ids, cohort_ids
                    dept_scenario_ids = ddata.get("scenario_ids")
                    dept_rubric_ids = ddata.get("rubric_ids")
                    dept_cohort_ids = ddata.get("cohort_ids")
                    
                    # Convert to list[str] if present, otherwise None
                    def to_str_list(value: Any) -> list[str] | None:
                        if value is None:
                            return None
                        if isinstance(value, list):
                            return [str(v) for v in value if v]
                        return None
                    
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                        scenario_ids=to_str_list(dept_scenario_ids),
                        rubric_ids=to_str_list(dept_rubric_ids),
                        cohort_ids=to_str_list(dept_cohort_ids),
                    )

        # Parse parameter mapping from JSONB with type safety (may be string or dict)
        parameter_mapping: ParameterMapping = {}
        parameter_mapping_data = result.get("parameter_mapping")
        if isinstance(parameter_mapping_data, str):
            parameter_mapping_data = json.loads(parameter_mapping_data)
        if parameter_mapping_data and isinstance(parameter_mapping_data, dict):
            for pid, pdata in parameter_mapping_data.items():
                if isinstance(pdata, dict):
                    parameter_mapping[pid] = ParameterMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                        numerical=pdata.get("numerical", False),
                        document_parameter=pdata.get("document_parameter", False),
                    )

        # Parse parameter item mapping from JSONB with type safety (may be string or dict)
        parameter_item_mapping: ParameterItemMapping = {}
        parameter_item_mapping_data = result.get("parameter_item_mapping")
        if isinstance(parameter_item_mapping_data, str):
            parameter_item_mapping_data = json.loads(parameter_item_mapping_data)
        if parameter_item_mapping_data and isinstance(parameter_item_mapping_data, dict):
            for piid, pidata in parameter_item_mapping_data.items():
                if isinstance(pidata, dict):
                    parameter_item_mapping[piid] = ParameterItemMappingItem(
                        name=pidata.get("name", ""),
                        description=pidata.get("description", ""),
                        parameter_id=pidata.get("parameter_id", ""),
                        parameter_name=pidata.get("parameter_name", ""),
                        value=pidata.get("value", ""),
                    )

        # Parse parameter items list from JSONB with type safety
        parameter_items_list: list[ParameterItemDetail] = []
        if result.get("parameter_items_list") and isinstance(
            result["parameter_items_list"], list
        ):
            for pi_data in result["parameter_items_list"]:
                if isinstance(pi_data, dict):
                    parameter_items_list.append(
                        ParameterItemDetail(
                            id=pi_data.get("id", ""),
                            parameter_id=pi_data.get("parameter_id", ""),
                            name=pi_data.get("name", ""),
                            description=pi_data.get("description"),
                        )
                    )

        # Parse department_ids from query (None = cross-department)
        department_ids = result.get("department_ids")
        if department_ids:
            department_ids = [str(d) for d in department_ids]

        return SimulationDetailResponse(
            name=result["title"],  # Schema uses 'name' but DB has 'title'
            description=result["description"],
            department_ids=department_ids,  # None or list of department IDs
            time_limit=result.get("time_limit"),
            rubric_id=result.get("rubric_id"),
            active=result["active"],
            practice_simulation=result["practice_simulation"],
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
            # Note: create_simulation() query doesn't accept department_ids - handled separately
            query = self.queries.create_simulation()
            result = await self.conn.fetchrow(
                query,
                request.title,
                request.description,
                request.active,
                request.practice_simulation,
                request.rubric_id,
            )

            if not result:
                raise ValueError("Failed to create simulation")

            simulation_id = str(result["id"])

            # Insert department links if department_ids provided
            if request.department_ids:
                insert_dept_query, insert_dept_params = (
                    self.queries.create_simulation_departments(
                        simulation_id, request.department_ids
                    )
                )
                await self.conn.execute(insert_dept_query, *insert_dept_params)

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
                    idx,
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
                request.active,
                request.practice_simulation,
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

            # Update simulation-department links (DELETE + INSERT pattern)
            delete_dept_query, delete_dept_params = (
                self.queries.delete_simulation_departments(request.simulationId)
            )
            await self.conn.execute(delete_dept_query, *delete_dept_params)

            # Insert new department links if department_ids provided
            if request.department_ids:
                insert_dept_query, insert_dept_params = (
                    self.queries.create_simulation_departments(
                        request.simulationId, request.department_ids
                    )
                )
                await self.conn.execute(insert_dept_query, *insert_dept_params)

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
                    idx,
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
        # Convert None to empty string to avoid PostgreSQL parameter type ambiguity
        scenario_override = scenario_id_override if scenario_id_override else ""
        query, params = self.queries.start_simulation_attempt_complete(
            simulation_id, profile_id, scenario_override, infinite
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
        
        # Parse JSONB fields if they're strings
        if isinstance(simulation_data, str):
            import json
            simulation_data = json.loads(simulation_data)
        if isinstance(scenario_metadata, str):
            import json
            scenario_metadata = json.loads(scenario_metadata)

        # Build scenario object from metadata
        # Note: department_id will be extracted from scenario after randomization
        scenario = {
            "id": scenario_id,
            "name": scenario_name,
            "problem_statement": problem_statement,
            "active": scenario_metadata["active"],
            "generated": scenario_metadata["generated"],
        }
        
        # Randomly fill scenario attributes (this will select department_id internally)
        from app.services.scenario_service import ScenarioService
        scenario_service = ScenarioService(self.conn)
        filled_scenario = await scenario_service.randomly_fill_scenario_attributes(
            scenario,
            profile_id=profile_id,
        )
        
        # Extract department_id from filled scenario
        department_id = str(filled_scenario.get("department_id"))
        if not department_id:
            raise ValueError("Failed to get department_id from randomized scenario")
        
        # Update scenario with filled data
        scenario.update(filled_scenario)
        scenario["department_id"] = department_id

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
            
            # Create new scenario with generated content
            from app.queries.scenario_queries import ScenarioQueries
            scenario_queries = ScenarioQueries()
            query = scenario_queries.insert_scenario_variant()
            new_scenario = await self.conn.fetchrow(
                query,
                name,  # scenario name ($1)
                True,  # generated = True ($2)
                True,  # active = True ($3)
                False,  # hints_enabled ($4)
                True,  # objectives_enabled ($5)
                False,  # image_input_enabled ($6)
                False,  # copy_paste_allowed ($7)
                False,  # input_guardrail_enabled ($8)
                False,  # output_guardrail_enabled ($9)
            )
            
            # Insert problem statement
            await self.conn.fetchrow(
                scenario_queries.insert_scenario_problem_statement(),
                new_scenario["id"],
                description,  # problem_statement
                True,  # active = True
            )
            
            # Create scenario_tree edge to track parent-child relationship
            tree_edge_query = scenario_queries.insert_scenario_tree_edge()
            await self.conn.execute(
                tree_edge_query,
                scenario_id,  # parent (original scenario from simulation)
                new_scenario["id"],  # child (generated variant)
                True,  # active
            )
            
            # Use randomly_fill_scenario_attributes to fill persona/documents/params
            # Pass parent's data so child inherits from parent instead of random selection
            from app.services.scenario_service import ScenarioService
            scenario_service = ScenarioService(self.conn)
            
            # Extract parent IDs for inheritance
            parent_persona_ids = [str(persona_id)] if persona_id else None
            parent_doc_ids = [str(doc["id"]) for doc in documents] if documents else None
            parent_param_ids = [str(item["id"]) for item in parameter_items] if parameter_items else None
            
            # Pass parent data to ensure child inherits attributes
            filled_scenario = await scenario_service.randomly_fill_scenario_attributes(
                scenario={
                    "id": str(new_scenario["id"]),
                    "name": name,
                    "active": True,
                    "generated": True,
                },
                profile_id=attempt_profile_id,
                parent_persona_ids=parent_persona_ids,
                parent_document_ids=parent_doc_ids,
                parent_parameter_item_ids=parent_param_ids,
            )
            
            # Extract department_id from filled scenario for agent call
            department_id = str(filled_scenario.get("department_id"))
            if not department_id:
                raise ValueError("Failed to get department_id from randomized scenario")
            
            # Use the returned scenario (which might be a new variant with persona/docs/params)
            final_scenario_id = filled_scenario["id"]
            
            # Update scenario object with final scenario data
            scenario["id"] = str(final_scenario_id)
            scenario["name"] = name
            scenario["problem_statement"] = description
            scenario["generated"] = True
            
            chat_title = name
            
            # Update chat title and scenario_id in database
            query = self.queries.update_chat_title()
            await self.conn.execute(query, chat_id, name)
            
            # Update chat to reference the FINAL scenario (after persona/docs/params added)
            query = "UPDATE simulation_chats SET scenario_id = $1 WHERE id = $2"
            await self.conn.execute(query, final_scenario_id, chat_id)
        else:
            # Use existing scenario data
            chat_title = scenario_name
            trace_id = gen_trace_id()

        # Update the trace_id in the database to use the proper format
        query = "UPDATE simulation_chats SET trace_id = $1 WHERE id = $2"
        await self.conn.execute(query, trace_id, chat_id)

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
        end_all: bool,
        previous_chat_id: str | None = None,
        previous_chat_map: dict[str, str | None] | None = None,
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

        # Get the attempt with profile
        query, params = self.queries.get_attempt_with_profile(attempt_id)
        attempt_with_profile = await self.conn.fetchrow(query, *params)
        if not attempt_with_profile:
            raise ValueError("Attempt not found")
        
        simulation_attempt = attempt_with_profile
        profile_id = attempt_with_profile.get("profile_id")
        
        # Extract department_id from chat/scenario for grading
        from app.queries.agent_queries import AgentQueries
        agent_queries = AgentQueries()
        query, params = agent_queries.get_simulation_run_context(str(chat_id))
        run_context = await self.conn.fetchrow(query, *params)
        
        if not run_context or not run_context.get("department_id"):
            raise ValueError(f"Failed to get department_id from run context for chat {chat_id}")
        
        department_id = run_context["department_id"]

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
        
        # Debug: Check if existing_chats have 'id' field
        if existing_chats and "id" not in existing_chats[0]:
            raise ValueError(f"Existing chats missing 'id' field: {existing_chats[0]}")
        
        # Get scenarios that already have graded chats (completed with grade)
        # A scenario is considered done only if it has at least one chat with a grade
        query = """
            SELECT DISTINCT sc.scenario_id
            FROM attempt_chats ac
            JOIN simulation_chats sc ON sc.id = ac.chat_id
            JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
            WHERE ac.attempt_id = $1 AND sc.completed = true
        """
        scenarios_with_grades = await self.conn.fetch(query, attempt_id)
        scenarios_with_grades_set = {
            str(row["scenario_id"]) for row in scenarios_with_grades
        }
        
        # Get current chat's scenario_id to exclude it from next scenario selection
        # (for normal grading, we don't want to create another chat for the current scenario)
        current_chat_scenario_id = str(chat.get("scenario_id"))
        
        # Also get scenarios that already have chats (even without grades) to avoid duplicates
        # This prevents creating multiple chats for the same scenario in the same attempt
        existing_scenario_ids = {
            str(ec.get("scenario_id")) for ec in existing_chats if ec.get("scenario_id")
        }
        
        # Find the next scenario index that doesn't have a graded chat
        # Exclude the current chat's scenario (it will be graded but doesn't have a grade yet)
        # Also exclude scenarios that already have chats (to prevent duplicates)
        next_index = None
        for idx, scenario_link in enumerate(scenario_links):
            scenario_id_str = str(scenario_link["scenario_id"])
            # Skip scenarios that:
            # 1. Already have grades (completed with grade)
            # 2. Are the current chat's scenario (will be graded)
            # 3. Already have a chat in this attempt (prevent duplicates)
            if (scenario_id_str not in scenarios_with_grades_set 
                and scenario_id_str != current_chat_scenario_id
                and scenario_id_str not in existing_scenario_ids):
                next_index = idx
                break
        
        # If all scenarios have graded chats or only current scenario remains, use the length for infinite mode cycling
        if next_index is None:
            next_index = len(scenario_links)

        # Handle previous_chat_id if provided (reusing score from previous attempt)
        if previous_chat_id:
            # Link the previous chat to current attempt via junction table
            query = self.queries.link_chat_to_attempt()
            await self.conn.execute(query, attempt_id, previous_chat_id)
            
            # Check if the previous chat has a grade and update scenarios_with_grades_set
            query = """
                SELECT sc.scenario_id, scg.id IS NOT NULL as has_grade
                FROM simulation_chats sc
                LEFT JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
                WHERE sc.id = $1 AND sc.completed = true
            """
            prev_chat_info = await self.conn.fetchrow(query, previous_chat_id)
            if prev_chat_info and prev_chat_info["has_grade"] and prev_chat_info["scenario_id"]:
                scenarios_with_grades_set.add(str(prev_chat_info["scenario_id"]))
                # Recalculate next_index since we now have a new scenario with a grade
                next_index = None
                for idx, scenario_link in enumerate(scenario_links):
                    scenario_id_str = str(scenario_link["scenario_id"])
                    if scenario_id_str not in scenarios_with_grades_set:
                        next_index = idx
                        break
                if next_index is None:
                    next_index = len(scenario_links)
            
            # Mark current incomplete chat as completed (without grade = skipped)
            query, params = self.queries.update_chat_completed(chat_id)
            await self.conn.execute(query, *params)
            
            # If end_all, mark all remaining incomplete chats as completed
            if end_all:
                for existing_chat in existing_chats:
                    if not existing_chat["completed"] and existing_chat["id"] != chat_id:
                        query, params = self.queries.update_chat_completed(
                            str(existing_chat["id"])
                        )
                        await self.conn.execute(query, *params)
        
        # Handle previous_chat_map if provided (for end_all with permutations)
        created_chats_count_map = 0
        if end_all and previous_chat_map:
            # Mark current chat as completed (without grading - user is using previous chat scores)
            query, params = self.queries.update_chat_completed(chat_id)
            await self.conn.execute(query, *params)
            
            # Get scenario IDs that already have chats in this attempt
            existing_scenario_ids = {
                str(ec.get("scenario_id")) for ec in existing_chats if ec.get("scenario_id")
            }
            
            # Process ALL scenarios in the simulation
            # For each scenario in previous_chat_map: link previous chat if provided
            # For scenarios NOT in previous_chat_map: create skipped chat if they don't have a chat yet
            for scenario_link in scenario_links:
                scenario_id_str = str(scenario_link["scenario_id"])
                
                if scenario_id_str in previous_chat_map:
                    # User selected a previous chat to reuse for this scenario
                    prev_chat_id = previous_chat_map[scenario_id_str]
                    if prev_chat_id:
                        # Link the previous chat to current attempt via junction table
                        query = self.queries.link_chat_to_attempt()
                        await self.conn.execute(query, attempt_id, prev_chat_id)
                        
                        # Check if the previous chat has a grade and update scenarios_with_grades_set
                        query = """
                            SELECT sc.scenario_id, scg.id IS NOT NULL as has_grade
                            FROM simulation_chats sc
                            LEFT JOIN simulation_chat_grades scg ON scg.simulation_chat_id = sc.id
                            WHERE sc.id = $1 AND sc.completed = true
                        """
                        prev_chat_info = await self.conn.fetchrow(query, prev_chat_id)
                        if prev_chat_info and prev_chat_info["has_grade"] and prev_chat_info["scenario_id"]:
                            scenarios_with_grades_set.add(str(prev_chat_info["scenario_id"]))
                elif scenario_id_str not in existing_scenario_ids:
                    # Scenario not in map and doesn't have a chat yet = skipped, create new completed chat (no grade)
                    created = await self._create_chat_for_scenario(
                        scenario_id_str,
                        attempt_id,
                        profile_id,
                        mark_completed=True,
                    )
                    if created is None:
                        # Scenario not found, skip it
                        continue
                    created_chats_count_map += 1
        elif end_all and not previous_chat_map and not previous_chat_id:
            # If end_all but no previous_chat_map or previous_chat_id, mark all remaining incomplete chats as completed (skipped)
            for existing_chat in existing_chats:
                if not existing_chat["completed"]:
                    query, params = self.queries.update_chat_completed(
                        str(existing_chat["id"])
                    )
                    await self.conn.execute(query, *params)
        
        # Create next chat if not end_all (works for both previous_chat_id and normal cases)
        next_chat_id = chat_id
        if not end_all and scenario_links:
            next_scenario_id = None
            if is_infinite_mode:
                # Cycle through the configured scenarios indefinitely
                # Find the next scenario without a graded chat, cycling if needed
                # Exclude the current chat's scenario (it will be graded but doesn't have a grade yet)
                # Also exclude scenarios that already have chats (to prevent duplicates)
                num_scenarios = len(scenario_links)
                if num_scenarios > 0:
                    # Start from next_index and cycle until we find one without a graded chat
                    for offset in range(num_scenarios):
                        cycling_index = (next_index + offset) % num_scenarios
                        scenario_id_str = str(scenario_links[cycling_index]["scenario_id"])
                        # Skip scenarios that:
                        # 1. Already have grades OR
                        # 2. Are the current chat's scenario OR
                        # 3. Already have a chat in this attempt
                        if (scenario_id_str not in scenarios_with_grades_set 
                            and scenario_id_str != current_chat_scenario_id
                            and scenario_id_str not in existing_scenario_ids):
                            next_scenario_id = scenario_links[cycling_index]["scenario_id"]
                            break
            elif next_index is not None and next_index < len(scenario_links):
                # Use the next scenario that doesn't have a graded chat
                # (next_index already excludes current_chat_scenario_id)
                next_scenario_id = scenario_links[next_index]["scenario_id"]

            if next_scenario_id is not None:
                # Double-check that this scenario doesn't already have a graded chat,
                # is not the current chat's scenario, and doesn't already have a chat
                # (it might have been created between the query and now)
                scenario_id_str = str(next_scenario_id)
                if (scenario_id_str not in scenarios_with_grades_set 
                    and scenario_id_str != current_chat_scenario_id
                    and scenario_id_str not in existing_scenario_ids):
                    created_next_chat = await self._create_chat_for_scenario(
                        scenario_id_str,
                        attempt_id,
                        profile_id,
                        mark_completed=False,
                    )
                    if created_next_chat is None:
                        raise ValueError("Next scenario not found")
                    if "id" not in created_next_chat:
                        raise ValueError(f"Created chat missing 'id' field: {created_next_chat}")
                    next_chat_id = created_next_chat["id"]

        # Grade the just-completed chat if it has at least 2 messages
        # Skip grading if using previous_chat_id or previous_chat_map (user is reusing previous scores)
        simulation_grade_id = None
        if not previous_chat_id and not previous_chat_map:
            # Use optimized batch query to get message counts
            existing_chat_ids = [str(c["id"]) for c in existing_chats]
            query, params = self.queries.get_messages_count_by_chat_ids(existing_chat_ids)
            message_counts = await self.conn.fetch(query, *params)
            message_count_map = {
                str(row["chat_id"]): row["message_count"] for row in message_counts
            }

            chat_message_count = message_count_map.get(chat_id, 0)
            if chat_message_count >= 2:
                from uuid import UUID

                simulation_grade_id = await run_grade_agent(
                    UUID(chat_id), UUID(department_id), self.conn, sio_instance
                )  # type: ignore
                
                # After grading completes, add current chat's scenario to scenarios_with_grades_set
                # and recalculate next_index (similar to previous_chat_id handling)
                # This is mainly for tracking purposes - the next chat was already created correctly
                # because we excluded current_chat_scenario_id and existing_scenario_ids when creating it
                graded_chat_scenario_id = str(chat.get("scenario_id"))
                if graded_chat_scenario_id:
                    scenarios_with_grades_set.add(graded_chat_scenario_id)
                    # Recalculate next_index since we now have a new scenario with a grade
                    # This is for consistency and future operations, but shouldn't affect next_chat_id
                    # since it was already created with proper exclusions
                    next_index = None
                    for idx, scenario_link in enumerate(scenario_links):
                        scenario_id_str = str(scenario_link["scenario_id"])
                        if scenario_id_str not in scenarios_with_grades_set:
                            next_index = idx
                            break
                    if next_index is None:
                        next_index = len(scenario_links)

            # Mark the current chat as completed (if not already marked by previous_chat_map handling)
            if not (end_all and previous_chat_map):
                query, params = self.queries.update_chat_completed(chat_id)
                await self.conn.execute(query, *params)

        created_chats_count = 0
        # Only process remaining chats if not using previous_chat_map (already handled above)
        if end_all and not previous_chat_id and not previous_chat_map:
            # End any other incomplete chats for this attempt
            existing_chat_ids = [str(c["id"]) for c in existing_chats]
            query, params = self.queries.get_messages_count_by_chat_ids(existing_chat_ids)
            message_counts = await self.conn.fetch(query, *params)
            message_count_map = {
                str(row["chat_id"]): row["message_count"] for row in message_counts
            }
            
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
                    str(next_id), attempt_id, profile_id, mark_completed=True
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

        # Include chats created from previous_chat_map handling
        total_created_chats = created_chats_count + created_chats_count_map

        return {
            "completed_chat_id": chat_id,
            "next_chat_id": next_chat_id,
            "is_attempt_finished": is_attempt_finished,
            "simulation_grade_id": simulation_grade_id,
            "created_chats_count": total_created_chats,
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
        profile_id: str | None,
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

        # Randomly fill any null attributes (this will select department_id internally)
        # Create scenario service locally to avoid storing service dependencies
        from app.services.scenario_service import ScenarioService

        scenario_service = ScenarioService(self.conn)
        scenario = await scenario_service.randomly_fill_scenario_attributes(
            dict(old_scenario), profile_id=profile_id
        )

        # Set chat title and generate trace_id
        chat_title = scenario["name"]
        trace_id = gen_trace_id()

        # Create chat
        query = self.queries.create_simulation_chat()
        chat = await self.conn.fetchrow(
            query,
            datetime.now(UTC),
            chat_title,
            scenario_id,
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
