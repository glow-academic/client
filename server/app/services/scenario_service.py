"""Scenario service layer - business logic for scenario operations."""

import json
import uuid
from typing import Any

import asyncpg  # type: ignore
from app.cache import keys
from app.db import transaction
from app.queries.scenario_queries import ScenarioQueries
from app.schemas.base import (CohortMappingItem, DepartmentMappingItem,
                              DocumentMappingItem, ObjectiveMappingItem,
                              ParameterItemMappingItem, ParameterMappingItem,
                              PersonaMappingItem, ScenarioMappingItem,
                              SimulationMappingItem)
from app.schemas.scenarios import (CreateScenarioRequest,
                                   CreateScenarioResponse,
                                   DeleteScenarioRequest,
                                   DeleteScenarioResponse, DocumentDetailItem,
                                   DuplicateScenarioRequest,
                                   DuplicateScenarioResponse,
                                   GenerateScenarioAIRequest,
                                   GenerateScenarioAIResponse, ParameterDetail,
                                   RandomizeScenarioRequest,
                                   RandomizeScenarioResponse,
                                   ScenarioDetailDefaultRequest,
                                   ScenarioDetailRequest,
                                   ScenarioDetailResponse, ScenarioItem,
                                   ScenariosFilters, ScenariosListResponse,
                                   UpdateScenarioRequest,
                                   UpdateScenarioResponse)
from app.services.base_service import BaseService, with_cache
from app.utils.search import build_fuzzy_conditions, normalize_text, tokenize


class ScenarioService(BaseService):
    """Service layer for scenario operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database session."""
        super().__init__(conn)
        self.queries = ScenarioQueries()

    @with_cache(lambda self, scenario_ids: keys.scenario_mapping(scenario_ids))
    async def build_enhanced_scenario_mapping(
        self, scenario_ids: list[str]
    ) -> dict[str, ScenarioMappingItem]:
        """Build enhanced scenario mapping with nested persona, document, and parameter data."""
        if not scenario_ids:
            return {}

        # Get all data in ONE consolidated query (C1 consolidation)
        query, params = self.queries.get_enhanced_scenario_mapping_complete(
            scenario_ids
        )
        result = await self.conn.fetch(query, *params)

        # Parse the consolidated result with JSONB mappings
        enhanced_mapping = {}
        for row in result:
            scenario_id = str(row["scenario_id"])
            parameter_item_ids = [str(pid) for pid in (row["parameter_item_ids"] or [])]
            document_ids = [str(did) for did in (row["document_ids"] or [])]

            # Parse JSONB persona mapping (may be string or dict)
            persona_mapping_raw = row["persona_mapping"]
            if isinstance(persona_mapping_raw, str):
                persona_mapping_global = json.loads(persona_mapping_raw)
            else:
                persona_mapping_global = persona_mapping_raw or {}

            scenario_persona_mapping = {}
            if row["persona_id"]:
                persona_id_str = str(row["persona_id"])
                if persona_id_str in persona_mapping_global:
                    pdata = persona_mapping_global[persona_id_str]
                    scenario_persona_mapping[persona_id_str] = PersonaMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                        color=pdata.get("color", ""),
                        icon=pdata.get("icon", ""),
                        image_model=pdata.get("image_model"),
                    )

            # Parse JSONB document mapping (may be string or dict)
            document_mapping_raw = row["document_mapping"]
            if isinstance(document_mapping_raw, str):
                document_mapping_global = json.loads(document_mapping_raw)
            else:
                document_mapping_global = document_mapping_raw or {}

            scenario_document_mapping = {}
            for did in document_ids:
                if did in document_mapping_global:
                    ddata = document_mapping_global[did]
                    scenario_document_mapping[did] = DocumentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                        filePath=ddata.get("filePath"),
                        mimeType=ddata.get("mimeType"),
                    )

            # Parse JSONB parameter_item mapping (may be string or dict)
            param_item_mapping_raw = row["param_item_mapping"]
            if isinstance(param_item_mapping_raw, str):
                param_item_mapping_global = json.loads(param_item_mapping_raw)
            else:
                param_item_mapping_global = param_item_mapping_raw or {}

            scenario_parameter_item_mapping = {}
            for pid in parameter_item_ids:
                if pid in param_item_mapping_global:
                    pidata = param_item_mapping_global[pid]
                    scenario_parameter_item_mapping[pid] = ParameterItemMappingItem(
                        name=pidata.get("name", ""),
                        description=pidata.get("description", ""),
                        parameter_id=pidata.get("parameter_id", ""),
                        parameter_name=pidata.get("parameter_name", ""),
                        value=pidata.get("value", ""),
                    )

            enhanced_mapping[scenario_id] = ScenarioMappingItem(
                name=row["name"],
                description=row["description"],
                persona_id=str(row["persona_id"]) if row["persona_id"] else None,
                persona_mapping=scenario_persona_mapping,
                document_mapping=scenario_document_mapping,
                parameter_item_mapping=scenario_parameter_item_mapping,
                parameter_item_ids=parameter_item_ids,
                document_ids=document_ids,
            )

        return enhanced_mapping

    @with_cache(lambda self, filters: keys.scenario_list(filters))
    async def get_scenarios_list(
        self, filters: ScenariosFilters
    ) -> ScenariosListResponse:
        """Get scenarios list with all relationships using dynamic SQL."""
        # Get query from query builder
        query, params = self.queries.list_scenarios(
            filters.profileId
        )

        result = await self.conn.fetch(query, *params)

        # Build response
        scenarios = []
        objective_mapping = {}
        parameter_item_mapping = {}
        cohort_mapping = {}
        persona_mapping = {}
        simulation_mapping = {}
        department_mapping: dict[str, DepartmentMappingItem] = {}

        # Parse mappings from first row (same across all rows)
        if result:
            first_row = result[0]

            # Parse objective mapping from JSONB with type safety (may be string or dict)
            objective_mapping_data = first_row.get("objective_mapping")
            if isinstance(objective_mapping_data, str):
                objective_mapping_data = json.loads(objective_mapping_data)
            if objective_mapping_data and isinstance(objective_mapping_data, dict):
                for oid, odata in objective_mapping_data.items():
                    if isinstance(odata, dict):
                        objective_mapping[oid] = ObjectiveMappingItem(
                            name=odata.get("name", ""),
                            description=odata.get("description", ""),
                        )

            # Parse parameter_item mapping from JSONB with type safety (may be string or dict)
            parameter_item_mapping_data = first_row.get("parameter_item_mapping")
            if isinstance(parameter_item_mapping_data, str):
                parameter_item_mapping_data = json.loads(parameter_item_mapping_data)
            if parameter_item_mapping_data and isinstance(parameter_item_mapping_data, dict):
                for pid, pdata in parameter_item_mapping_data.items():
                    if isinstance(pdata, dict):
                        parameter_item_mapping[pid] = ParameterItemMappingItem(
                            name=pdata.get("name", ""),
                            description=pdata.get("description", ""),
                            parameter_id=str(pdata["parameter_id"])
                            if pdata.get("parameter_id")
                            else "",
                            parameter_name=pdata.get("parameter_name", ""),
                            value=pdata.get("value", ""),
                        )

            # Parse cohort mapping from JSONB with type safety (may be string or dict)
            cohort_mapping_data = first_row.get("cohort_mapping")
            if isinstance(cohort_mapping_data, str):
                cohort_mapping_data = json.loads(cohort_mapping_data)
            if cohort_mapping_data and isinstance(cohort_mapping_data, dict):
                for cid, cdata in cohort_mapping_data.items():
                    if isinstance(cdata, dict):
                        cohort_mapping[cid] = CohortMappingItem(
                            name=cdata.get("name", ""),
                            description=cdata.get("description", ""),
                        )

            # Parse persona mapping from JSONB with type safety (may be string or dict)
            persona_mapping_data = first_row.get("persona_mapping")
            if isinstance(persona_mapping_data, str):
                persona_mapping_data = json.loads(persona_mapping_data)
            if persona_mapping_data and isinstance(persona_mapping_data, dict):
                for persona_id, pdata in persona_mapping_data.items():
                    if isinstance(pdata, dict):
                        persona_mapping[persona_id] = PersonaMappingItem(
                            name=pdata.get("name", ""),
                            description=pdata.get("description", ""),
                            color=pdata.get("color", ""),
                            icon=pdata.get("icon", ""),
                        )

            # Parse simulation mapping from JSONB with type safety (may be string or dict)
            simulation_mapping_data = first_row.get("simulation_mapping")
            if isinstance(simulation_mapping_data, str):
                simulation_mapping_data = json.loads(simulation_mapping_data)
            if simulation_mapping_data and isinstance(simulation_mapping_data, dict):
                from app.schemas.base import SimulationMappingItem

                for sim_id, sdata in simulation_mapping_data.items():
                    if isinstance(sdata, dict):
                        # Handle department_ids - may be array or null
                        dept_ids = sdata.get("department_ids")
                        if isinstance(dept_ids, str):
                            try:
                                dept_ids = json.loads(dept_ids)
                            except (json.JSONDecodeError, ValueError):
                                dept_ids = [dept_ids] if dept_ids else None
                        elif dept_ids is None:
                            dept_ids = None
                        elif not isinstance(dept_ids, list):
                            dept_ids = [dept_ids] if dept_ids else None
                        
                        simulation_mapping[sim_id] = SimulationMappingItem(
                            name=sdata.get("name", ""),
                            description=sdata.get("description", ""),
                            time_limit=sdata.get("time_limit"),
                            department_ids=dept_ids,
                        )

            # Parse department_mapping from JSONB with type safety (may be string or dict)
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

        # Build scenario items
        for row in result:
            objective_ids = row["objective_ids"] or []
            parameter_item_ids = [str(pid) for pid in (row["parameter_item_ids"] or [])]
            simulation_ids = [str(sid) for sid in (row["simulation_ids"] or [])]
            cohort_ids = [str(cid) for cid in (row["cohort_ids"] or [])]
            dept_ids = None
            if row.get("department_ids"):
                dept_ids = [str(d) for d in row["department_ids"]]

            scenarios.append(
                ScenarioItem(
                    scenario_id=str(row["scenario_id"]),
                    title=row["title"],
                    problem_statement=row["problem_statement"],
                    active=row["active"],
                    generated=row["generated"],
                    parent_scenario_id=row["parent_scenario_id"],
                        department_ids=dept_ids,
                    objective_ids=objective_ids,
                    persona_id=str(row["persona_id"]) if row["persona_id"] else None,
                    parameter_item_ids=parameter_item_ids,
                    simulation_ids=simulation_ids,
                    num_simulations=row["num_simulations"],
                    can_edit=row["can_edit"],
                    can_delete=row["can_delete"],
                    can_duplicate=row["can_duplicate"],
                    cohort_ids=cohort_ids,
                )
            )

        return ScenariosListResponse(
            scenarios=scenarios,
            objective_mapping=objective_mapping,
            parameter_item_mapping=parameter_item_mapping,
            cohort_mapping=cohort_mapping,
            persona_mapping=persona_mapping,
            simulation_mapping=simulation_mapping,
            department_mapping=department_mapping,
        )

    @with_cache(
        lambda self, request: keys.scenario_by_id(request.scenarioId, request.profileId)
    )
    async def get_scenario_detail(
        self, request: ScenarioDetailRequest
    ) -> ScenarioDetailResponse:
        """Get detailed scenario information using dynamic SQL."""
        # Get complete scenario data with all mappings (mega consolidated query)
        query, params = self.queries.get_scenario_detail_complete(
            request.scenarioId, request.profileId
        )
        scenario = await self.conn.fetchrow(query, *params)

        if not scenario:
            raise ValueError(f"Scenario not found: {request.scenarioId}")

        # Parse basic data
        persona_id = scenario["persona_id"]
        # Note: document_ids from query may be incorrect due to cache/query issues
        # We'll derive it from document_details which is the source of truth
        document_ids_from_query = scenario["document_ids"] or []
        objective_ids = scenario["objective_ids"] or []
        active_simulation_ids = scenario["simulation_ids"] or []
        valid_persona_ids = scenario["valid_persona_ids"] or []
        valid_document_ids = scenario["valid_document_ids"] or []
        # Convert dept_ids to strings (may come as UUIDs from query)
        dept_ids_raw = scenario["valid_department_ids"] or []
        dept_ids = [str(did) for did in dept_ids_raw]

        # Parse JSONB parameters into ParameterDetail dict
        parameters_dict: dict[str, ParameterDetail] = {}
        params_data = scenario.get("parameters_json")
        if isinstance(params_data, str):
            params_data = json.loads(params_data)
        if params_data and isinstance(params_data, dict):
            for param_id, param_detail in params_data.items():
                if isinstance(param_detail, dict):
                    # Extract arrays from JSONB
                    param_item_ids = param_detail.get("parameter_item_ids", [])
                    valid_param_item_ids = param_detail.get(
                        "valid_parameter_item_ids", []
                    )

                    # Convert JSONB arrays to Python lists if needed
                    if not isinstance(param_item_ids, list):
                        param_item_ids = []
                    if not isinstance(valid_param_item_ids, list):
                        valid_param_item_ids = []

                    parameters_dict[param_id] = ParameterDetail(
                        parameter_item_ids=param_item_ids,
                        valid_parameter_item_ids=valid_param_item_ids,
                    )

        # Parse JSONB objective mapping (may be string or dict)
        objective_mapping = {}
        obj_mapping_data = scenario.get("objective_mapping")
        if isinstance(obj_mapping_data, str):
            obj_mapping_data = json.loads(obj_mapping_data)
        if obj_mapping_data and isinstance(obj_mapping_data, dict):
            for oid, odata in obj_mapping_data.items():
                if isinstance(odata, dict):
                    objective_mapping[oid] = ObjectiveMappingItem(
                        name=odata.get("name", ""),
                        description=odata.get("description", ""),
                    )

        # Parse JSONB persona mapping (may be string or dict)
        persona_mapping = {}
        persona_mapping_data = scenario.get("persona_mapping")
        if isinstance(persona_mapping_data, str):
            persona_mapping_data = json.loads(persona_mapping_data)
        if persona_mapping_data and isinstance(persona_mapping_data, dict):
            for pid, pdata in persona_mapping_data.items():
                if isinstance(pdata, dict):
                    persona_mapping[pid] = PersonaMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                        color=pdata.get("color", ""),
                        icon=pdata.get("icon", ""),
                        image_model=pdata.get("image_model"),
                    )

        # Parse JSONB document mapping (may be string or dict)
        document_mapping = {}
        doc_mapping_data = scenario.get("document_mapping")
        if isinstance(doc_mapping_data, str):
            doc_mapping_data = json.loads(doc_mapping_data)
        if doc_mapping_data and isinstance(doc_mapping_data, dict):
            for did, ddata in doc_mapping_data.items():
                if isinstance(ddata, dict):
                    document_mapping[did] = DocumentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                        filePath=ddata.get("filePath"),
                        mimeType=ddata.get("mimeType"),
                    )

        # Parse JSONB simulation mapping (may be string or dict)
        simulation_mapping = {}
        sim_mapping_data = scenario.get("simulation_mapping")
        if isinstance(sim_mapping_data, str):
            sim_mapping_data = json.loads(sim_mapping_data)
        if sim_mapping_data and isinstance(sim_mapping_data, dict):
            for sid, sdata in sim_mapping_data.items():
                if isinstance(sdata, dict):
                    simulation_mapping[sid] = SimulationMappingItem(
                        name=sdata.get("name", ""),
                        description=sdata.get("description", ""),
                        time_limit=sdata.get("time_limit"),
                        department_ids=sdata.get("department_ids"),
                    )

        # Parse JSONB parameter mapping (may be string or dict)
        parameter_mapping = {}
        param_mapping_data = scenario.get("parameter_mapping")
        if isinstance(param_mapping_data, str):
            param_mapping_data = json.loads(param_mapping_data)
        if param_mapping_data and isinstance(param_mapping_data, dict):
            for pid, pdata in param_mapping_data.items():
                if isinstance(pdata, dict):
                    parameter_mapping[pid] = ParameterMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                        numerical=pdata.get("numerical", False),
                    )

        # Parse JSONB parameter_item mapping (may be string or dict)
        param_item_full_mapping = {}
        param_item_mapping_data = scenario.get("parameter_item_mapping")
        if isinstance(param_item_mapping_data, str):
            param_item_mapping_data = json.loads(param_item_mapping_data)
        if param_item_mapping_data and isinstance(param_item_mapping_data, dict):
            for piid, pidata in param_item_mapping_data.items():
                if isinstance(pidata, dict):
                    param_item_full_mapping[piid] = ParameterItemMappingItem(
                        name=pidata.get("name", ""),
                        description=pidata.get("description", ""),
                        parameter_id=pidata.get("parameter_id", ""),
                        parameter_name=pidata.get("parameter_name", ""),
                        value=pidata.get("value", ""),
                    )

        # Parse JSONB department mapping (may be string or dict)
        department_mapping: dict[str, DepartmentMappingItem] = {}
        dept_mapping_data = scenario.get("department_mapping")
        if isinstance(dept_mapping_data, str):
            dept_mapping_data = json.loads(dept_mapping_data)
        if dept_mapping_data and isinstance(dept_mapping_data, dict):
            for did, ddata in dept_mapping_data.items():
                if isinstance(ddata, dict):
                    # Parse optional ID arrays (handle None, empty arrays, or missing keys)
                    # Scenario form needs: persona_ids, document_ids, parameter_ids, parameter_item_ids
                    persona_ids = ddata.get("persona_ids")
                    document_ids = ddata.get("document_ids")
                    parameter_ids = ddata.get("parameter_ids")
                    parameter_item_ids = ddata.get("parameter_item_ids")
                    
                    # Convert to list[str] if present, otherwise None
                    # Handle JSONB null values (which become Python None) and arrays
                    def to_str_list(value: Any) -> list[str] | None:
                        if value is None:
                            return None
                        if isinstance(value, list):
                            # Filter out None/null values and convert to strings
                            # Keep empty lists as [] since schema accepts both [] and None
                            return [str(v) for v in value if v is not None]
                        return None
                    
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                        persona_ids=to_str_list(persona_ids),
                        document_ids=to_str_list(document_ids),
                        parameter_ids=to_str_list(parameter_ids),
                        parameter_item_ids=to_str_list(parameter_item_ids),
                    )

        # Parse JSONB problem statement mapping (may be string or dict)
        problem_statement_mapping: dict[str, ProblemStatementInfo] = {}
        ps_mapping_data = scenario.get("problem_statement_mapping")
        if isinstance(ps_mapping_data, str):
            ps_mapping_data = json.loads(ps_mapping_data)
        if ps_mapping_data and isinstance(ps_mapping_data, dict):
            for psid, psdata in ps_mapping_data.items():
                if isinstance(psdata, dict):
                    from app.schemas.scenarios import ProblemStatementInfo

                    problem_statement_mapping[psid] = ProblemStatementInfo(
                        problem_statement=psdata.get("problem_statement", ""),
                        created_at=psdata.get("created_at", ""),
                        updated_at=psdata.get("updated_at", ""),
                    )

        # Parse objectives_history JSONB array (now with department_ids)
        objectives_history: list[ObjectiveWithDepartments] = []
        obj_history_data = scenario.get("objectives_history")
        if isinstance(obj_history_data, str):
            obj_history_data = json.loads(obj_history_data)
        if obj_history_data and isinstance(obj_history_data, list):
            from app.schemas.scenarios import ObjectiveWithDepartments
            
            for obj_data in obj_history_data:
                if isinstance(obj_data, dict):
                    objectives_history.append(
                        ObjectiveWithDepartments(
                            objective=obj_data.get("objective", ""),
                            department_ids=obj_data.get("department_ids", []) or []
                        )
                    )
                elif isinstance(obj_data, str):
                    # Fallback for backward compatibility (shouldn't happen with new query)
                    objectives_history.append(
                        ObjectiveWithDepartments(
                            objective=obj_data,
                            department_ids=[]
                        )
                    )

        # Parse document_details from JSONB (array of full document objects)
        document_details: list[DocumentDetailItem] = []
        doc_details_data = scenario.get("document_details")
        if isinstance(doc_details_data, str):
            doc_details_data = json.loads(doc_details_data)
        if doc_details_data and isinstance(doc_details_data, list):
            for doc in doc_details_data:
                if isinstance(doc, dict):
                    document_details.append(
                        DocumentDetailItem(
                            document_id=doc.get("document_id", ""),
                            name=doc.get("name", ""),
                            type=doc.get("type", ""),
                            updatedAt=doc.get("updatedAt", ""),
                            extension=doc.get("extension", ""),
                            scenario_ids=doc.get("scenario_ids", []),
                            can_edit=doc.get("can_edit", True),
                            can_delete=doc.get("can_delete", True),
                            active=doc.get("active", True),
                            department_ids=[str(d) for d in doc.get("department_ids", [])] if doc.get("department_ids") else None,
                            file_path=doc.get("file_path", ""),
                            mime_type=doc.get("mime_type", ""),
                            parameter_item_ids=doc.get("parameter_item_ids", []),
                        )
                    )
        
        # Derive document_ids from document_details (source of truth)
        # This ensures consistency since document_details is correctly filtered by scenario_id
        document_ids = [doc.document_id for doc in document_details if doc.document_id]

        # Compute permissions from query data
        in_use_by_active = scenario["active_usage_count"] > 0
        is_generated = scenario["generated"]
        is_superadmin = scenario["user_role"] == "superadmin"

        can_edit = not in_use_by_active and not is_generated
        can_duplicate = True  # Always allowed
        can_delete = not in_use_by_active and is_superadmin

        # Parse department_ids from query (None = cross-department)
        department_ids = scenario.get("department_ids")
        if department_ids:
            department_ids = [str(d) for d in department_ids]

        return ScenarioDetailResponse(
            # Basic fields
            name=scenario["name"],
            problem_statement=scenario["problem_statement"],
            problem_statement_id=scenario.get("problem_statement_id"),
            active=scenario["active"],
            generated=is_generated,
            hints_enabled=scenario.get("hints_enabled", False),
            objectives_enabled=scenario.get("objectives_enabled", True),
            image_input_enabled=scenario.get("image_input_enabled", False),
            copy_paste_allowed=scenario.get("copy_paste_allowed", False),
            input_guardrail_enabled=scenario.get("input_guardrail_enabled", False),
            output_guardrail_enabled=scenario.get("output_guardrail_enabled", False),
            parent_scenario_id=scenario["parent_scenario_id"],
            # Department
            department_ids=department_ids,  # None or list of department IDs
            valid_department_ids=dept_ids,
            # IDs
            persona_id=persona_id,
            valid_persona_ids=valid_persona_ids,
            document_ids=document_ids,
            valid_document_ids=valid_document_ids,
            # Objectives
            objective_ids=objective_ids,
            valid_objectives=[],  # Empty (free-form)
            objectives_history=objectives_history,
            # Parameters
            parameters=parameters_dict,
            # Simulations
            active_simulation_ids=active_simulation_ids,
            # Document details
            document_details=document_details,
            # Permissions
            can_edit=can_edit,
            can_duplicate=can_duplicate,
            can_delete=can_delete,
            # Mappings
            parameter_mapping=parameter_mapping,
            parameter_item_mapping=param_item_full_mapping,
            simulation_mapping=simulation_mapping,
            persona_mapping=persona_mapping,
            document_mapping=document_mapping,
            objective_mapping=objective_mapping,
            department_mapping=department_mapping,
            problem_statement_mapping=problem_statement_mapping,
        )

    @with_cache(lambda self, request: keys.scenario_default(request.profileId))
    async def get_scenario_detail_default(
        self, request: ScenarioDetailDefaultRequest
    ) -> ScenarioDetailResponse:
        """Get default scenario structure for creation mode."""
        # Get all data in ONE consolidated query
        query, params = self.queries.get_scenario_detail_default_complete(
            request.profileId
        )
        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError("Failed to fetch default scenario data")

        dept_ids = result["department_ids"] or []

        if not dept_ids:
            raise ValueError("No accessible departments found for user")

        # Default department (first accessible)
        default_dept_id = dept_ids[0]

        # Extract data from consolidated query result
        valid_persona_ids = result["valid_persona_ids"] or []
        valid_document_ids = result["valid_document_ids"] or []

        # Parse JSONB mappings (may be string or dict)
        persona_mapping_data = result.get("persona_mapping") or {}
        if isinstance(persona_mapping_data, str):
            persona_mapping_data = json.loads(persona_mapping_data)
        persona_mapping = {}
        if isinstance(persona_mapping_data, dict):
            for pid, pdata in persona_mapping_data.items():
                if isinstance(pdata, dict):
                    persona_mapping[pid] = PersonaMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                        color=pdata.get("color", ""),
                        icon=pdata.get("icon", ""),
                        image_model=pdata.get("image_model"),
                    )

        document_mapping_data = result.get("document_mapping") or {}
        if isinstance(document_mapping_data, str):
            document_mapping_data = json.loads(document_mapping_data)
        document_mapping = {}
        if isinstance(document_mapping_data, dict):
            for did, ddata in document_mapping_data.items():
                if isinstance(ddata, dict):
                    document_mapping[did] = DocumentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                    )

        parameter_mapping_data = result.get("parameter_mapping") or {}
        if isinstance(parameter_mapping_data, str):
            parameter_mapping_data = json.loads(parameter_mapping_data)
        parameter_mapping = {}
        if isinstance(parameter_mapping_data, dict):
            for param_id, pdata in parameter_mapping_data.items():
                if isinstance(pdata, dict):
                    parameter_mapping[param_id] = ParameterMappingItem(
                        name=pdata.get("name", ""),
                        description=pdata.get("description", ""),
                        numerical=pdata.get("numerical", False),
                    )

        parameter_item_mapping_data = result.get("parameter_item_mapping") or {}
        if isinstance(parameter_item_mapping_data, str):
            parameter_item_mapping_data = json.loads(parameter_item_mapping_data)
        parameter_item_mapping = {}
        if isinstance(parameter_item_mapping_data, dict):
            for piid, pidata in parameter_item_mapping_data.items():
                if isinstance(pidata, dict):
                    parameter_item_mapping[piid] = ParameterItemMappingItem(
                        name=pidata.get("name", ""),
                        description=pidata.get("description", ""),
                        parameter_id=pidata.get("parameter_id", ""),
                        parameter_name=pidata.get("parameter_name", ""),
                        value=pidata.get("value", ""),
                    )

        department_mapping_data = result.get("department_mapping") or {}
        if isinstance(department_mapping_data, str):
            department_mapping_data = json.loads(department_mapping_data)
        department_mapping: dict[str, DepartmentMappingItem] = {}
        if isinstance(department_mapping_data, dict):
            for did, ddata in department_mapping_data.items():
                if isinstance(ddata, dict):
                    # Parse optional ID arrays (handle None, empty arrays, or missing keys)
                    # Scenario form needs: persona_ids, document_ids, parameter_ids, parameter_item_ids
                    persona_ids = ddata.get("persona_ids")
                    document_ids = ddata.get("document_ids")
                    parameter_ids = ddata.get("parameter_ids")
                    parameter_item_ids = ddata.get("parameter_item_ids")
                    
                    # Convert to list[str] if present, otherwise None
                    # Handle JSONB null values (which become Python None) and arrays
                    def to_str_list(value: Any) -> list[str] | None:
                        if value is None:
                            return None
                        if isinstance(value, list):
                            # Filter out None/null values and convert to strings
                            # Keep empty lists as [] since schema accepts both [] and None
                            return [str(v) for v in value if v is not None]
                        return None
                    
                    department_mapping[did] = DepartmentMappingItem(
                        name=ddata.get("name", ""),
                        description=ddata.get("description", ""),
                        persona_ids=to_str_list(persona_ids),
                        document_ids=to_str_list(document_ids),
                        parameter_ids=to_str_list(parameter_ids),
                        parameter_item_ids=to_str_list(parameter_item_ids),
                    )

        # Parse JSONB problem statement mapping (empty for default)
        problem_statement_mapping: dict[str, ProblemStatementInfo] = {}
        ps_mapping_data = result.get("problem_statement_mapping")
        if isinstance(ps_mapping_data, str):
            ps_mapping_data = json.loads(ps_mapping_data)
        if ps_mapping_data and isinstance(ps_mapping_data, dict):
            for psid, psdata in ps_mapping_data.items():
                if isinstance(psdata, dict):
                    from app.schemas.scenarios import ProblemStatementInfo

                    problem_statement_mapping[psid] = ProblemStatementInfo(
                        problem_statement=psdata.get("problem_statement", ""),
                        created_at=psdata.get("created_at", ""),
                        updated_at=psdata.get("updated_at", ""),
                    )

        # Parse objectives_history JSONB array (now with department_ids)
        objectives_history: list[ObjectiveWithDepartments] = []
        obj_history_data = result.get("objectives_history")
        if isinstance(obj_history_data, str):
            obj_history_data = json.loads(obj_history_data)
        if obj_history_data and isinstance(obj_history_data, list):
            from app.schemas.scenarios import ObjectiveWithDepartments
            
            for obj_data in obj_history_data:
                if isinstance(obj_data, dict):
                    objectives_history.append(
                        ObjectiveWithDepartments(
                            objective=obj_data.get("objective", ""),
                            department_ids=obj_data.get("department_ids", []) or []
                        )
                    )
                elif isinstance(obj_data, str):
                    # Fallback for backward compatibility (shouldn't happen with new query)
                    objectives_history.append(
                        ObjectiveWithDepartments(
                            objective=obj_data,
                            department_ids=[]
                        )
                    )

        # Parse JSONB parameters into ParameterDetail dict
        parameters_dict: dict[str, ParameterDetail] = {}
        params_data = result.get("parameters_json")
        if isinstance(params_data, str):
            params_data = json.loads(params_data)
        if params_data and isinstance(params_data, dict):
            for param_id, param_detail in params_data.items():
                if isinstance(param_detail, dict):
                    # Extract arrays from JSONB
                    param_item_ids = param_detail.get("parameter_item_ids", [])
                    valid_param_item_ids = param_detail.get(
                        "valid_parameter_item_ids", []
                    )

                    # Convert JSONB arrays to Python lists if needed
                    if not isinstance(param_item_ids, list):
                        param_item_ids = []
                    if not isinstance(valid_param_item_ids, list):
                        valid_param_item_ids = []

                    parameters_dict[param_id] = ParameterDetail(
                        parameter_item_ids=param_item_ids,
                        valid_parameter_item_ids=valid_param_item_ids,
                    )

        # Parse document_details from JSONB (empty array for create mode)
        document_details: list[DocumentDetailItem] = []
        doc_details_data = result.get("document_details")
        if isinstance(doc_details_data, str):
            doc_details_data = json.loads(doc_details_data)
        if doc_details_data and isinstance(doc_details_data, list):
            for doc in doc_details_data:
                if isinstance(doc, dict):
                    document_details.append(
                        DocumentDetailItem(
                            document_id=doc.get("document_id", ""),
                            name=doc.get("name", ""),
                            type=doc.get("type", ""),
                            updatedAt=doc.get("updatedAt", ""),
                            extension=doc.get("extension", ""),
                            scenario_ids=doc.get("scenario_ids", []),
                            can_edit=doc.get("can_edit", True),
                            can_delete=doc.get("can_delete", True),
                            active=doc.get("active", True),
                            department_ids=[str(d) for d in doc.get("department_ids", [])] if doc.get("department_ids") else None,
                            file_path=doc.get("file_path", ""),
                            mime_type=doc.get("mime_type", ""),
                            parameter_item_ids=doc.get("parameter_item_ids", []),
                        )
                    )

        # Return empty scenario with all valid options
        # Default to first department or None (cross-department if superadmin)
        default_department_ids = [default_dept_id] if default_dept_id else None

        return ScenarioDetailResponse(
            # Basic fields (empty defaults)
            name="",
            problem_statement="",
            problem_statement_id=None,
            active=True,
            generated=False,
            hints_enabled=False,
            objectives_enabled=True,
            image_input_enabled=False,
            copy_paste_allowed=False,
            input_guardrail_enabled=False,
            output_guardrail_enabled=False,
            parent_scenario_id=None,
            # Department
            department_ids=default_department_ids,
            valid_department_ids=dept_ids,
            # IDs (empty defaults)
            persona_id=None,
            valid_persona_ids=valid_persona_ids,
            document_ids=[],
            valid_document_ids=valid_document_ids,
            # Objectives (empty defaults)
            objective_ids=[],
            valid_objectives=[],
            objectives_history=objectives_history,
            # Parameters (with valid options for creation)
            parameters=parameters_dict,
            # Simulations (empty defaults)
            active_simulation_ids=[],
            # Document details (empty for create mode)
            document_details=document_details,
            # Permissions (allow all for new scenarios)
            can_edit=True,
            can_duplicate=False,  # Can't duplicate non-existent scenario
            can_delete=False,  # Can't delete non-existent scenario
            # Mappings
            parameter_mapping=parameter_mapping,
            parameter_item_mapping=parameter_item_mapping,
            simulation_mapping={},
            persona_mapping=persona_mapping,
            document_mapping=document_mapping,
            objective_mapping={},
            department_mapping=department_mapping,
            problem_statement_mapping=problem_statement_mapping,
        )

    async def create_scenario(
        self, request: CreateScenarioRequest
    ) -> CreateScenarioResponse:
        """Create a new scenario using asyncpg."""

        async with transaction(self.conn):
            # Insert scenario with positional params
            # Note: create_scenario() query doesn't accept department_ids - handled separately
            create_query = self.queries.create_scenario()
            result = await self.conn.fetchrow(
                create_query,
                request.name,
                request.active,
                request.hints_enabled,
                request.objectives_enabled,
                request.image_input_enabled,
                request.copy_paste_allowed,
                request.input_guardrail_enabled,
                request.output_guardrail_enabled,
            )

            if not result:
                raise ValueError("Failed to create scenario")

            scenario_id = str(result["id"])

            # Insert department links if department_ids provided
            if request.department_ids:
                insert_dept_query, insert_dept_params = (
                    self.queries.create_scenario_departments(
                        scenario_id, request.department_ids
                    )
                )
                await self.conn.execute(insert_dept_query, *insert_dept_params)

            # Insert self-referencing edge in scenario_tree to mark as parent/root
            tree_edge_query = self.queries.insert_scenario_tree_edge()
            await self.conn.execute(
                tree_edge_query,
                scenario_id,
                scenario_id,
                True,
            )

            # Insert problem statement versions (if provided) or single problem statement
            if request.problem_statement_versions and len(request.problem_statement_versions) > 0:
                # Save all versions: last one (most recent) is active, others inactive
                versions_list = [v for v in request.problem_statement_versions if v and v.strip()]
                for idx, version_text in enumerate(versions_list):
                    problem_stmt_query = self.queries.insert_scenario_problem_statement()
                    await self.conn.execute(
                        problem_stmt_query,
                        scenario_id,
                        version_text.strip(),
                        idx == len(versions_list) - 1,  # Last version (most recent) is active
                    )
            elif request.problem_statement:
                # Single problem statement (existing behavior)
                problem_stmt_query = self.queries.insert_scenario_problem_statement()
                await self.conn.execute(
                    problem_stmt_query,
                    scenario_id,
                    request.problem_statement,
                    True,
                )

            # Insert persona relationship
            if request.persona_id:
                persona_query = self.queries.insert_scenario_persona()
                await self.conn.execute(
                    persona_query,
                    scenario_id,
                    request.persona_id,
                )

            # Insert document relationships
            for document_id in request.document_ids:
                doc_query = self.queries.insert_scenario_document()
                await self.conn.execute(
                    doc_query,
                    scenario_id,
                    document_id,
                )

            # Insert objectives
            for idx, obj_id in enumerate(request.objective_ids):
                # If it's a composite ID, parse it; otherwise treat as raw text
                if "_" in obj_id and len(obj_id.split("_")) == 2:
                    # Skip - it's a reference to existing objective
                    continue
                else:
                    # New objective text
                    obj_insert_query = self.queries.insert_scenario_objective()
                    await self.conn.execute(
                        obj_insert_query,
                        scenario_id,
                        idx,
                        obj_id,
                    )

            # Insert parameter relationships
            for parameter_id, parameter_item_ids in request.parameters.items():
                for param_item_id in parameter_item_ids:
                    param_query = self.queries.insert_scenario_parameter()
                    await self.conn.execute(
                        param_query,
                        scenario_id,
                        param_item_id,
                    )

            # Invalidate affected caches
            await self._invalidate_cache(
                [
                    keys.tag_scenario_all(),
                    keys.tag_analytics_all(),
                ]
            )

            return CreateScenarioResponse(
                success=True,
                scenarioId=scenario_id,
                message=f"Scenario '{request.name}' created successfully",
            )

    async def update_scenario(
        self, request: UpdateScenarioRequest
    ) -> UpdateScenarioResponse:
        """Update an existing scenario using asyncpg."""

        async with transaction(self.conn):
            # Check if scenario exists
            query, params = self.queries.get_scenario_name(request.scenarioId)
            existing = await self.conn.fetchrow(query, *params)

            if not existing:
                raise ValueError(f"Scenario not found: {request.scenarioId}")

            # Update scenario basic fields with positional params
            update_query = self.queries.update_scenario()
            await self.conn.execute(
                update_query,
                request.name,
                request.active,
                request.hints_enabled,
                request.objectives_enabled,
                request.image_input_enabled,
                request.copy_paste_allowed,
                request.input_guardrail_enabled,
                request.output_guardrail_enabled,
                request.scenarioId,
            )

            # Update problem statement (always create new version, deactivate old)
            if request.problem_statement:
                # First deactivate any existing active problem statements
                deactivate_query, deactivate_params = (
                    self.queries.deactivate_scenario_problem_statements(
                        request.scenarioId
                    )
                )
                await self.conn.execute(deactivate_query, *deactivate_params)
                # Then create the new active problem statement
                query, params = self.queries.create_scenario_problem_statement(
                    request.scenarioId, request.problem_statement
                )
                await self.conn.fetchval(query, *params)

            # Update scenario-department links (DELETE + INSERT pattern)
            delete_dept_query, delete_dept_params = (
                self.queries.delete_scenario_departments(request.scenarioId)
            )
            await self.conn.execute(delete_dept_query, *delete_dept_params)

            # Insert new department links if department_ids provided
            if request.department_ids:
                insert_dept_query, insert_dept_params = (
                    self.queries.create_scenario_departments(
                        request.scenarioId, request.department_ids
                    )
                )
                await self.conn.execute(insert_dept_query, *insert_dept_params)

            # Update persona (delete old, insert new)
            query, params = self.queries.delete_scenario_personas(request.scenarioId)
            await self.conn.execute(query, *params)

            if request.persona_id:
                insert_persona_query = self.queries.insert_scenario_persona()
                await self.conn.execute(
                    insert_persona_query,
                    request.scenarioId,
                    request.persona_id,
                )

            # Update documents
            query, params = self.queries.delete_scenario_documents(request.scenarioId)
            await self.conn.execute(query, *params)

            for document_id in request.document_ids:
                insert_doc_query = self.queries.insert_scenario_document()
                await self.conn.execute(
                    insert_doc_query,
                    request.scenarioId,
                    document_id,
                )

            # Update objectives
            query, params = self.queries.delete_scenario_objectives(request.scenarioId)
            await self.conn.execute(query, *params)

            for idx, obj_id in enumerate(request.objective_ids):
                if "_" in obj_id and len(obj_id.split("_")) == 2:
                    # Skip existing composite IDs
                    continue
                else:
                    # New objective
                    insert_obj_query = self.queries.insert_scenario_objective()
                    await self.conn.execute(
                        insert_obj_query,
                        request.scenarioId,
                        idx,
                        obj_id,
                    )

            # Update parameters
            query, params = self.queries.delete_scenario_parameters(request.scenarioId)
            await self.conn.execute(query, *params)

            for parameter_id, parameter_item_ids in request.parameters.items():
                for param_item_id in parameter_item_ids:
                    insert_param_query = self.queries.insert_scenario_parameter()
                    await self.conn.execute(
                        insert_param_query,
                        request.scenarioId,
                        param_item_id,
                    )

            # Invalidate affected caches
            await self._invalidate_cache(
                [
                    keys.tag_scenario_by_id(request.scenarioId),
                    keys.tag_scenario_all(),
                    keys.tag_analytics_all(),
                ]
            )

            return UpdateScenarioResponse(
                success=True, message=f"Scenario '{request.name}' updated successfully"
            )

    async def duplicate_scenario(
        self, request: DuplicateScenarioRequest
    ) -> DuplicateScenarioResponse:
        """Duplicate a scenario using asyncpg."""

        async with transaction(self.conn):
            # Get original scenario
            query, params = self.queries.get_scenario_for_duplicate(request.scenarioId)
            original = await self.conn.fetchrow(query, *params)

            if not original:
                raise ValueError(f"Scenario not found: {request.scenarioId}")

            # Create duplicate - query handles department links
            insert_query = self.queries.insert_duplicate_scenario()
            new_scenario = await self.conn.fetchrow(
                insert_query,
                original["name"],
                original.get("hints_enabled", False),
                original.get("objectives_enabled", True),
                original.get("image_input_enabled", False),
                original.get("copy_paste_allowed", False),
                original.get("input_guardrail_enabled", False),
                original.get("output_guardrail_enabled", False),
            )

            if not new_scenario:
                raise ValueError("Failed to create duplicate scenario")

            new_scenario_id = str(new_scenario["id"])

            # Insert self-referencing edge in scenario_tree to mark as parent/root
            tree_edge_query = self.queries.insert_scenario_tree_edge()
            await self.conn.execute(
                tree_edge_query,
                new_scenario_id,
                new_scenario_id,
                True,
            )

            # Copy problem statements (from junction table)
            copy_problem_statements_query = self.queries.copy_scenario_problem_statements()
            await self.conn.execute(
                copy_problem_statements_query,
                new_scenario_id,
                request.scenarioId,
            )

            # Copy persona relationship
            copy_persona_query = self.queries.copy_scenario_personas()
            await self.conn.execute(
                copy_persona_query,
                new_scenario_id,
                request.scenarioId,
            )

            # Copy document relationships
            copy_docs_query = self.queries.copy_scenario_documents()
            await self.conn.execute(
                copy_docs_query,
                new_scenario_id,
                request.scenarioId,
            )

            # Copy objectives
            copy_obj_query = self.queries.copy_scenario_objectives()
            await self.conn.execute(
                copy_obj_query,
                new_scenario_id,
                request.scenarioId,
            )

            # Copy parameters
            copy_params_query = self.queries.copy_scenario_parameters()
            await self.conn.execute(
                copy_params_query,
                new_scenario_id,
                request.scenarioId,
            )

            # Invalidate affected caches
            await self._invalidate_cache(
                [
                    keys.tag_scenario_all(),
                    keys.tag_analytics_all(),
                ]
            )

            return DuplicateScenarioResponse(
                success=True,
                scenarioId=new_scenario_id,
                message=f"Scenario '{original['name']}' duplicated successfully",
            )

    async def delete_scenario(
        self, request: DeleteScenarioRequest
    ) -> DeleteScenarioResponse:
        """Delete a scenario using asyncpg."""

        async with transaction(self.conn):
            # Check if in use
            query, params = self.queries.check_scenario_usage(request.scenarioId)
            usage = await self.conn.fetchrow(query, *params)

            if not usage:
                raise ValueError("Failed to check scenario usage")

            if usage["usage_count"] > 0:
                raise ValueError("Cannot delete scenario that is in use by simulations")

            # Get name for response
            query, params = self.queries.get_scenario_name(request.scenarioId)
            scenario = await self.conn.fetchrow(query, *params)

            if not scenario:
                raise ValueError(f"Scenario not found: {request.scenarioId}")

            # Delete scenario (cascades will handle junction tables)
            query, params = self.queries.delete_scenario(request.scenarioId)
            await self.conn.execute(query, *params)

            # Invalidate affected caches
            await self._invalidate_cache(
                [
                    keys.tag_scenario_by_id(request.scenarioId),
                    keys.tag_scenario_all(),
                    keys.tag_analytics_all(),
                ]
            )

            return DeleteScenarioResponse(
                success=True,
                message=f"Scenario '{scenario['name']}' deleted successfully",
            )

    # AI Generation and Randomization Methods
    async def generate_scenario_ai(
        self, request: GenerateScenarioAIRequest
    ) -> GenerateScenarioAIResponse:
        """
        Generate AI scenario content (title, description, objectives).
        Uses the scenario agent to create content based on inputs.
        """
        from app.agents.collection.scenario import run_scenario_agent

        # Convert string IDs to UUIDs
        department_id = uuid.UUID(request.departmentId)
        persona_id = uuid.UUID(request.personaId) if request.personaId else None
        document_ids = (
            [uuid.UUID(d) for d in request.documentIds] if request.documentIds else None
        )
        parameter_item_ids = (
            [uuid.UUID(p) for p in request.parameterItemIds]
            if request.parameterItemIds
            else None
        )
        profile_id = uuid.UUID(request.profileId) if request.profileId else None

        # Filter out empty lists
        if document_ids and len(document_ids) == 0:
            document_ids = None

        # Run the scenario agent
        # Note: run_scenario_agent needs to be migrated to use asyncpg conn
        # For now, passing conn and agent will handle conversion internally
        title, description, objectives, _ = await run_scenario_agent(
            department_id=department_id,
            persona_id=persona_id,
            document_ids=document_ids,
            parameter_item_ids=parameter_item_ids,
            group_id=None,
            conn=self.conn,
            profile_id=profile_id,
            user_instructions=request.userInstructions,
            objectives_enabled=request.objectivesEnabled,
        )

        # Limit objectives to maximum 3
        limited_objectives = objectives[:3] if objectives else []
        
        return GenerateScenarioAIResponse(
            success=True,
            message="Scenario generated successfully",
            title=title,
            description=description,
            objectives=limited_objectives,
        )

    async def randomize_scenario_sections(
        self, request: RandomizeScenarioRequest
    ) -> RandomizeScenarioResponse:
        """
        Suggest randomized persona/documents/parameters based on current inputs.
        """
        # Convert string IDs to UUIDs
        persona_id = uuid.UUID(request.personaId) if request.personaId else None
        document_ids = (
            [uuid.UUID(d) for d in request.documentIds] if request.documentIds else None
        )
        parameter_item_ids = (
            [uuid.UUID(p) for p in request.parameterItemIds]
            if request.parameterItemIds
            else None
        )
        department_ids = (
            [str(d) for d in request.departmentIds] if request.departmentIds else None
        )

        # Normalize empty lists
        if document_ids:
            document_ids = [d for d in document_ids if d]
        if parameter_item_ids:
            parameter_item_ids = [p for p in parameter_item_ids if p]
        if department_ids:
            department_ids = [d for d in department_ids if d]
        targets = [t for t in request.targets if t.strip()] if request.targets else []

        # Get suggestions using internal method
        suggestions = await self.suggest_randomized_sections(
            name=request.name,
            description=request.description,
            persona_id=persona_id,
            document_ids=document_ids,
            parameter_item_ids=parameter_item_ids,
            department_ids=department_ids,
            targets=targets,
        )

        return RandomizeScenarioResponse(
            success=True,
            message="Randomization suggestions generated",
            personaId=str(suggestions["persona_id"])
            if suggestions.get("persona_id")
            else None,
            documentIds=[str(x) for x in (suggestions.get("document_ids") or [])],
            parameterItemIds=[
                str(x) for x in (suggestions.get("parameter_item_ids") or [])
            ],
        )

    async def _get_randomization_data_parsed(
        self, department_ids: list[str] | None = None
    ) -> dict[str, Any]:
        """Get and parse randomization data from consolidated query.
        
        Returns a dict with parsed data structures ready for use:
        - active_personas: list[dict] with UUID ids
        - active_documents: list[dict] with UUID ids  
        - active_parameters: list[dict] with UUID ids
        - all_parameter_items: list[dict] with UUID ids
        - document_parameter_items_junction: list[dict] with UUID ids
        - parameter_items_by_id: dict[uuid.UUID, dict]
        - parameter_items_by_param_id: dict[uuid.UUID, list[dict]]
        - documents_by_id: dict[uuid.UUID, dict]
        """
        import json
        
        query, params = self.queries.get_randomization_data_complete(department_ids)
        result = await self.conn.fetchrow(query, *params)
        
        if not result:
            raise ValueError("Failed to fetch randomization data")
        
        # Parse JSONB aggregations (may be string or list)
        personas_data = result.get("personas", [])
        if isinstance(personas_data, str):
            personas_data = json.loads(personas_data)
        if not isinstance(personas_data, list):
            personas_data = []
        
        documents_data = result.get("documents", [])
        if isinstance(documents_data, str):
            documents_data = json.loads(documents_data)
        if not isinstance(documents_data, list):
            documents_data = []
        
        parameters_data = result.get("parameters", [])
        if isinstance(parameters_data, str):
            parameters_data = json.loads(parameters_data)
        if not isinstance(parameters_data, list):
            parameters_data = []
        
        parameter_items_data = result.get("parameter_items", [])
        if isinstance(parameter_items_data, str):
            parameter_items_data = json.loads(parameter_items_data)
        if not isinstance(parameter_items_data, list):
            parameter_items_data = []
        
        document_parameter_items_data = result.get("document_parameter_items", [])
        if isinstance(document_parameter_items_data, str):
            document_parameter_items_data = json.loads(document_parameter_items_data)
        if not isinstance(document_parameter_items_data, list):
            document_parameter_items_data = []
        
        # Convert UUIDs from JSON (they come as strings)
        active_personas = [dict(p) for p in personas_data]
        active_documents = [dict(d) for d in documents_data]
        active_parameters = [dict(p) for p in parameters_data]
        all_parameter_items = [dict(pi) for pi in parameter_items_data]
        document_parameter_items_junction = [
            {
                "document_id": uuid.UUID(str(j["document_id"])),
                "parameter_item_id": uuid.UUID(str(j["parameter_item_id"])),
            }
            for j in document_parameter_items_data
        ]
        
        # Build lookup maps for efficiency
        parameter_items_by_id: dict[uuid.UUID, dict[str, Any]] = {}
        for pi in all_parameter_items:
            pi_id = uuid.UUID(str(pi["id"]))
            parameter_items_by_id[pi_id] = {
                **pi,
                "id": pi_id,
                "parameter_id": uuid.UUID(str(pi["parameter_id"])),
            }
        
        parameter_items_by_param_id: dict[uuid.UUID, list[dict[str, Any]]] = {}
        for pi in all_parameter_items:
            param_id = uuid.UUID(str(pi["parameter_id"]))
            if param_id not in parameter_items_by_param_id:
                parameter_items_by_param_id[param_id] = []
            parameter_items_by_param_id[param_id].append(parameter_items_by_id[uuid.UUID(str(pi["id"]))])
        
        documents_by_id: dict[uuid.UUID, dict[str, Any]] = {}
        for d in active_documents:
            doc_id = uuid.UUID(str(d["id"]))
            documents_by_id[doc_id] = {**d, "id": doc_id}
        
        # Convert parameter IDs
        for p in active_parameters:
            p["id"] = uuid.UUID(str(p["id"]))
        
        return {
            "active_personas": active_personas,
            "active_documents": active_documents,
            "active_parameters": active_parameters,
            "all_parameter_items": all_parameter_items,
            "document_parameter_items_junction": document_parameter_items_junction,
            "parameter_items_by_id": parameter_items_by_id,
            "parameter_items_by_param_id": parameter_items_by_param_id,
            "documents_by_id": documents_by_id,
        }

    async def randomly_fill_scenario_attributes(
        self,
        scenario: dict[str, Any],
        profile_id: str | None = None,
        parent_persona_id: str | None = None,
        parent_document_ids: list[str] | None = None,
        parent_parameter_item_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        """Randomly fill null attributes of a scenario with available options from the database.

        Args:
            scenario: The scenario dict with potentially null attributes
            profile_id: Optional profile ID to get user's accessible departments for fallback
            parent_persona_id: Optional persona_id to inherit from parent scenario
            parent_document_ids: Optional document_ids to inherit from parent scenario
            parent_parameter_item_ids: Optional parameter_item_ids to inherit from parent scenario

        Returns:
            Updated scenario dict with randomly selected values for null attributes
        """
        import logging
        import random

        from app.utils.text_helpers import normalize_text, tokenize

        logger = logging.getLogger(__name__)
        scenario_id = scenario["id"]

        # NEW LOGIC: Select department_id first
        # Priority 1: Get department_ids from scenario_departments junction table
        query, params = self.queries.get_scenario_departments(str(scenario_id))
        scenario_dept_rows = await self.conn.fetch(query, *params)
        scenario_dept_ids = [row["department_id"] for row in scenario_dept_rows]

        selected_dept_id: uuid.UUID | None = None
        if scenario_dept_ids:
            # Randomly select one department from scenario's departments
            selected_dept_id = random.choice(scenario_dept_ids)
            logger.info(f"Selected department_id from scenario_departments: {selected_dept_id}")
        else:
            # Cross-department scenario - need to pick a department
            if profile_id:
                # Get user's accessible departments
                query, params = self.queries.get_departments_for_profile(profile_id)
                profile_dept_rows = await self.conn.fetch(query, *params)
                profile_dept_ids = [row["id"] for row in profile_dept_rows]
                if profile_dept_ids:
                    selected_dept_id = random.choice(profile_dept_ids)
                    logger.info(f"Selected department_id from user's accessible departments: {selected_dept_id}")
                else:
                    logger.warning(f"No accessible departments found for profile {profile_id}")
            else:
                # No profile_id - get all active departments
                query = "SELECT id FROM departments WHERE active = true"
                all_dept_rows = await self.conn.fetch(query)
                all_dept_ids = [row["id"] for row in all_dept_rows]
                if all_dept_ids:
                    selected_dept_id = random.choice(all_dept_ids)
                    logger.info(f"Selected department_id from all active departments: {selected_dept_id}")
                else:
                    logger.warning("No active departments found in database")

        if not selected_dept_id:
            raise ValueError("Cannot proceed without a department_id - no departments available")

        selected_dept_id_str = str(selected_dept_id)
        
        # Get all randomization data in a single query
        randomization_data = await self._get_randomization_data_parsed([selected_dept_id_str])
        active_personas = randomization_data["active_personas"]
        active_documents = randomization_data["active_documents"]
        active_parameters = randomization_data["active_parameters"]
        parameter_items_by_param_id = randomization_data["parameter_items_by_param_id"]
        documents_by_id = randomization_data["documents_by_id"]
        document_parameter_items_junction = randomization_data["document_parameter_items_junction"]

        # Get persona from parent, or from scenario_personas junction, or randomly select
        scenario_persona_id: uuid.UUID | None = None
        
        # Priority 1: Use parent's persona if provided
        if parent_persona_id:
            scenario_persona_id = uuid.UUID(parent_persona_id) if isinstance(parent_persona_id, str) else uuid.UUID(str(parent_persona_id))
            logger.info(f"Using parent persona_id: {scenario_persona_id}")
        else:
            # Priority 2: Check for existing persona link in database
            query, params = self.queries.get_scenario_persona_link(str(scenario_id))
            existing_persona_link = await self.conn.fetchrow(query, *params)
            scenario_persona_id = (
                existing_persona_link["persona_id"] if existing_persona_link else None
            )

        # Priority 3: Random persona selection if still none (filtered by selected department)
        if scenario_persona_id is None:
            if active_personas:
                persona_dict = random.choice(active_personas)
                scenario_persona_id = uuid.UUID(str(persona_dict["id"]))
                logger.info(f"Randomly selected persona_id: {scenario_persona_id}")

                # Create the junction record
                await self.conn.execute(
                    self.queries.insert_scenario_persona_link(),
                    scenario_id,
                    scenario_persona_id,
                    True,
                )
            else:
                scenario_persona_id = None
                logger.info("No active personas found")

        # NEW BUSINESS LOGIC: Get objectives (first 3 by idx)
        query, params = self.queries.get_scenario_objectives_top_n(str(scenario_id), 3)
        objectives_data = await self.conn.fetch(query, *params)
        scenario_objectives = [obj["objective"] for obj in objectives_data]
        logger.info(f"Found {len(scenario_objectives)} objectives for scenario: {scenario_objectives}")

        # NEW BUSINESS LOGIC: Get most recent active problem statement
        query, params = self.queries.get_scenario_problem_statement_active(str(scenario_id))
        problem_statement_row = await self.conn.fetchrow(query, *params)
        scenario_problem_statement = problem_statement_row["problem_statement"] if problem_statement_row else None
        logger.info(f"Found problem statement: {scenario_problem_statement}")
        
        # If no problem statement exists, generate one using AI
        if not scenario_problem_statement:
            logger.info("No problem statement found, generating one using AI")
            try:
                from app.agents.collection.scenario import run_scenario_agent

                # Get scenario metadata for AI generation
                query, params = self.queries.get_scenario_full_metadata(str(scenario_id))
                scenario_metadata = await self.conn.fetchrow(query, *params)
                
                doc_ids = list(scenario_metadata["document_ids"]) if scenario_metadata["document_ids"] else []
                param_ids = list(scenario_metadata["parameter_item_ids"]) if scenario_metadata["parameter_item_ids"] else []
                persona_id = scenario_metadata["persona_id"]
                
                # Generate problem statement using AI
                name, description, objectives, trace_id = await run_scenario_agent(
                    department_id=selected_dept_id,
                    persona_id=persona_id,
                    document_ids=[uuid.UUID(doc_id) for doc_id in doc_ids],
                    parameter_item_ids=[uuid.UUID(param_id) for param_id in param_ids],
                    group_id=None,  # No attempt context for scenario generation
                    conn=self.conn,
                    profile_id=None,  # No profile context for scenario generation
                )
                
                scenario_problem_statement = description
                logger.info(f"Generated problem statement: {scenario_problem_statement}")
                
            except Exception as e:
                logger.error(f"Failed to generate problem statement: {e}")
                scenario_problem_statement = None

        # Load existing documents and parameters from parent or junction tables
        existing_doc_ids = []
        existing_param_ids = []
        
        # Priority 1: Use parent's documents if provided
        if parent_document_ids:
            existing_doc_ids = [uuid.UUID(doc_id) for doc_id in parent_document_ids]
            logger.info(f"Using {len(existing_doc_ids)} parent documents")
        else:
            # Priority 2: Check database for existing document links
            query, params = self.queries.get_scenario_document_links(str(scenario_id))
            doc_links = await self.conn.fetch(query, *params)
            existing_doc_ids = [link["document_id"] for link in doc_links]

        # Priority 1: Use parent's parameter items if provided
        if parent_parameter_item_ids:
            existing_param_ids = [uuid.UUID(param_id) for param_id in parent_parameter_item_ids]
            logger.info(f"Using {len(existing_param_ids)} parent parameter items")
        else:
            # Priority 2: Check database for existing parameter links
            query, params = self.queries.get_scenario_parameter_links(str(scenario_id))
            param_links = await self.conn.fetch(query, *params)
            existing_param_ids = [link["parameter_item_id"] for link in param_links]

        # Priority 3: Random selection if documents still don't exist
        if not existing_doc_ids:
            # First, get parameter items for this scenario
            scenario_parameter_item_ids = []
            if existing_param_ids:
                scenario_parameter_item_ids = existing_param_ids
            else:
                # Get parameter items that will be selected below (filtered by selected department)
                if active_parameters:
                    for param in active_parameters:
                        param_items = parameter_items_by_param_id.get(param["id"], [])
                        if param_items:
                            selected_item = random.choice(param_items)
                            scenario_parameter_item_ids.append(selected_item["id"])

            # Try to find documents that match parameter items via document_parameter_items junction
            matching_documents = []
            if scenario_parameter_item_ids:
                # Find documents linked to parameter items via junction
                matching_documents = [
                    documents_by_id[j["document_id"]]
                    for j in document_parameter_items_junction
                    if j["parameter_item_id"] in scenario_parameter_item_ids
                    and j["document_id"] in documents_by_id
                ]
                logger.info(f"Found {len(matching_documents)} documents matching parameter items: {scenario_parameter_item_ids}")

            if matching_documents:
                # Select 1 document from matching documents
                selected_doc = random.choice(matching_documents)
                scenario_documents = [selected_doc["id"]]
                logger.info(f"Selected document via parameter items: {selected_doc['id']} ({selected_doc['name']})")
            else:
                # Fallback to text similarity scoring (filtered by selected department)
                logger.info("No documents match parameter items, falling back to text similarity")

                if active_documents:
                    # Build scenario signal text from name/problem_statement
                    scenario_text = f"{scenario.get('name') or ''} {scenario.get('problem_statement') or ''}"
                    scenario_tokens = set(tokenize(scenario_text))

                    known_types = [
                        "homework",
                        "project",
                        "quiz",
                        "midterm",
                        "lab",
                        "lecture",
                        "syllabus",
                    ]
                    scenario_has_type = {
                        t: (t in scenario_tokens) or (t in normalize_text(scenario_text))
                        for t in known_types
                    }

                    def _score(doc: dict[str, Any]) -> float:
                        score = 0.0
                        name_tokens = set(tokenize(doc.get("name") or ""))
                        score += 2.0 * len(scenario_tokens.intersection(name_tokens))
                        doc_type = (doc.get("type") or "").lower()
                        if doc_type and (scenario_has_type.get(doc_type, False)):
                            score += 10.0
                        if doc_type and doc_type in normalize_text(scenario_text):
                            score += 3.0
                        # add jitter to reduce determinism
                        score += random.random() * 0.25
                        return score

                    # Build clusters per tag and choose one tag to ensure all selected share the same tag
                    tag_to_docs: dict[str, list[dict[str, Any]]] = {}
                    for d in active_documents:
                        tags = ["__untagged__"]  # doc.tags removed in BCNF migration
                        for t in tags:
                            tag_to_docs.setdefault(t, []).append(d)

                    # Score each tag by the best document score in that cluster
                    tag_scores: list[tuple[str, float]] = []
                    for t, docs in tag_to_docs.items():
                        best = 0.0
                        for d in docs:
                            s = _score(d)
                            if s > best:
                                best = s
                        # jitter per tag to avoid ties
                        tag_scores.append((t, best + random.random() * 0.1))

                    tag_scores.sort(key=lambda x: x[1], reverse=True)
                    chosen_tag = tag_scores[0][0] if tag_scores else "__untagged__"
                    candidates = tag_to_docs.get(chosen_tag, [])
                    # Sort candidates by score and take 1, but sample randomly among top N
                    cand_scored = [(d, _score(d)) for d in candidates]
                    cand_scored.sort(key=lambda x: x[1], reverse=True)
                    top_n = cand_scored[: min(6, len(cand_scored))]
                    k = min(1, len(top_n))
                    selected_docs = [d for d, _ in random.sample(top_n, k)] if k > 0 else []
                    logger.info(
                        f"Selected document via text similarity with shared tag '{chosen_tag}' (count={len(selected_docs)}): {[d['id'] for d in selected_docs]}"
                    )

                    scenario_documents = [doc["id"] for doc in selected_docs]
                else:
                    scenario_documents = []
                    logger.info("No active documents found")
        else:
            # Keep existing documents - don't add more
            scenario_documents = existing_doc_ids
            logger.info(f"Scenario already has {len(existing_doc_ids)} documents, skipping document selection")

        # Random parameter item selection if no parameters linked via junction (filtered by selected department)
        if not existing_param_ids:
            if active_parameters:
                # For each active parameter, randomly select one parameter item
                scenario_parameter_item_ids = []
                for param in active_parameters:
                    param_items = parameter_items_by_param_id.get(param["id"], [])
                    if param_items:
                        selected_item = random.choice(param_items)
                        scenario_parameter_item_ids.append(selected_item["id"])
                        logger.info(
                            f"Selected parameter item for {param['name']}: {selected_item['name']}"
                        )

                logger.info(
                    f"Randomly selected {len(scenario_parameter_item_ids)} parameter items (one per active parameter): {scenario_parameter_item_ids}"
                )
            else:
                scenario_parameter_item_ids = []
                logger.info("No active parameters found")
        else:
            # If parameter_item_ids are provided, ensure we have one per active parameter (filtered by selected department)
            active_param_ids = {param["id"] for param in active_parameters}
            
            # Get all parameter items for the existing IDs from lookup map
            parameter_items_by_id = randomization_data["parameter_items_by_id"]
            existing_param_items = [
                parameter_items_by_id[pid] for pid in existing_param_ids if pid in parameter_items_by_id
            ]

            # Group existing parameter items by their parameter_id
            existing_items_by_param: dict[uuid.UUID, list[dict[str, Any]]] = {}
            for item in existing_param_items:
                param_id = item["parameter_id"]
                if param_id not in existing_items_by_param:
                    existing_items_by_param[param_id] = []
                existing_items_by_param[param_id].append(item)

            # For each active parameter, ensure we have exactly one parameter item
            scenario_parameter_item_ids = []
            for param_id in active_param_ids:
                if param_id in existing_items_by_param:
                    items = existing_items_by_param[param_id]
                    if len(items) > 1:
                        selected_item = random.choice(items)
                        scenario_parameter_item_ids.append(selected_item["id"])
                    else:
                        scenario_parameter_item_ids.append(items[0]["id"])
                else:
                    # No items for this parameter, randomly select one (filtered by selected department)
                    param_items = parameter_items_by_param_id.get(param_id, [])
                    if param_items:
                        selected_item = random.choice(param_items)
                        scenario_parameter_item_ids.append(selected_item["id"])
                        logger.info(
                            f"Filled missing parameter item for parameter {param_id}: {selected_item['name']}"
                        )
                    else:
                        logger.warning(
                            f"No parameter items found for parameter {param_id}"
                        )

        # Load current linked docs/params from junction tables for comparison
        query, params = self.queries.get_scenario_document_links(str(scenario_id))
        current_doc_links = await self.conn.fetch(query, *params)
        current_doc_ids = sorted([link["document_id"] for link in current_doc_links])

        query, params = self.queries.get_scenario_parameter_links(str(scenario_id))
        current_param_links = await self.conn.fetch(query, *params)
        current_param_ids = sorted(
            [link["parameter_item_id"] for link in current_param_links]
        )

        # Get current persona from junction
        query, params = self.queries.get_scenario_persona_link(str(scenario_id))
        current_persona_link = await self.conn.fetchrow(query, *params)
        current_persona_id = (
            current_persona_link["persona_id"] if current_persona_link else None
        )

        # Compare with new values
        new_docs = sorted(scenario_documents or [])
        new_params = sorted(scenario_parameter_item_ids or [])

        if (
            scenario_persona_id == current_persona_id
            and new_docs == current_doc_ids
            and new_params == current_param_ids
        ):
            return scenario

        # Create a new scenario variant with changes
        new_scenario_row = await self.conn.fetchrow(
            self.queries.insert_scenario_variant(),
            scenario.get("name"),
            True,
            scenario.get("active", True),
            scenario.get("hints_enabled", False),
            scenario.get("objectives_enabled", True),
            scenario.get("image_input_enabled", False),
            scenario.get("input_guardrail_enabled", False),
            scenario.get("output_guardrail_enabled", False),
        )

        new_scenario_id = new_scenario_row["id"]
        new_scenario = dict(new_scenario_row)
        
        # NEW BUSINESS LOGIC: Copy objectives to new scenario
        if scenario_objectives:
            for idx, objective in enumerate(scenario_objectives, 1):
                await self.conn.execute(
                    self.queries.insert_scenario_objective(),
                    new_scenario_id,
                    idx,
                    objective,
                )
            logger.info(f"Copied {len(scenario_objectives)} objectives to new scenario variant")
        
        # NEW BUSINESS LOGIC: Copy problem statement to new scenario (if not already in insert_scenario_variant)
        if scenario_problem_statement and not new_scenario_row.get("problem_statement"):
            await self.conn.execute(
                self.queries.insert_scenario_problem_statement(),
                new_scenario_id,
                scenario_problem_statement,
                True,
            )
            logger.info(f"Copied problem statement to new scenario variant")

        # Create scenario_tree edge (parent -> child)
        await self.conn.execute(
            self.queries.insert_scenario_tree_edge(), scenario_id, new_scenario_id, True
        )

        # Create junction record for persona
        if scenario_persona_id:
            await self.conn.execute(
                self.queries.insert_scenario_persona_link(),
                new_scenario_id,
                scenario_persona_id,
                True,
            )

        # Create junction records for documents
        if scenario_documents:
            for doc_id in scenario_documents:
                await self.conn.execute(
                    self.queries.insert_scenario_document_link(),
                    new_scenario_id,
                    doc_id,
                    True,
                )

        # Create junction records for parameter items
        if scenario_parameter_item_ids:
            for param_id in scenario_parameter_item_ids:
                await self.conn.execute(
                    self.queries.insert_scenario_parameter_link(),
                    new_scenario_id,
                    param_id,
                    True,
                )

        # NEW BUSINESS LOGIC: Add objectives, problem statement, and department_id to return value
        new_scenario["objectives"] = scenario_objectives
        new_scenario["problem_statement"] = scenario_problem_statement
        new_scenario["department_id"] = selected_dept_id
        
        return new_scenario

    async def suggest_randomized_sections(
        self,
        *,
        name: str | None,
        description: str | None,
        persona_id: uuid.UUID | None,
        document_ids: list[uuid.UUID] | None,
        parameter_item_ids: list[uuid.UUID] | None,
        department_ids: list[str] | None = None,
        targets: list[str],
    ) -> dict[str, Any]:
        """Suggest persona/documents/parameters based on current inputs and text.

        - If a section isn't listed in targets, it is returned unchanged.
        - If listed, it is suggested using similarity heuristics against scenario text,
          selected persona, and selected documents.
        """
        import logging
        import random

        from app.utils.text_helpers import (
            normalize_text, read_document_content_for_similarity, tokenize,
            weighted_choice, weighted_sample_without_replacement)
        from rapidfuzz import fuzz  # type: ignore

        logger = logging.getLogger(__name__)
        targets_set = {t.lower() for t in (targets or [])}

        base_text = f"{name or ''} {description or ''}"
        context_tokens: set[str] = set(tokenize(base_text))
        # Keep a raw context string for fuzzy similarity (in addition to tokens)
        context_text = normalize_text(base_text)

        # Load current persona/documents if provided to enrich context
        current_persona: dict[str, Any] | None = None
        if persona_id:
            query, params = self.queries.get_persona_by_id(str(persona_id))
            current_persona = await self.conn.fetchrow(query, *params)
            if current_persona:
                context_tokens.update(tokenize(current_persona["name"]))
                context_tokens.update(tokenize(current_persona.get("description")))
                context_text = f"{context_text} {normalize_text(current_persona['name'])} {normalize_text(current_persona.get('description'))}"

        current_documents: list[dict[str, Any]] = []
        if document_ids:
            query, params = self.queries.get_documents_by_ids(
                [str(d) for d in document_ids]
            )
            current_documents = await self.conn.fetch(query, *params)
            current_documents = [dict(d) for d in current_documents]

            for d in current_documents:
                context_tokens.update(tokenize(d.get("name")))
                context_tokens.add(normalize_text(d.get("type")))
                # Include current document content to help parameter/persona choice
                try:
                    file_path = d.get("file_path")
                    if file_path:
                        doc_text = read_document_content_for_similarity(file_path)
                        # Limit size for performance
                        doc_text = doc_text[:5000]
                        context_text = f"{context_text} {normalize_text(doc_text)}"
                except Exception:
                    pass

        # Get all randomization data in a single query
        randomization_data = await self._get_randomization_data_parsed(department_ids)
        active_personas = randomization_data["active_personas"]
        active_documents = randomization_data["active_documents"]
        active_parameters = randomization_data["active_parameters"]
        all_parameter_items = randomization_data["all_parameter_items"]
        document_parameter_items_junction = randomization_data["document_parameter_items_junction"]
        parameter_items_by_id = randomization_data["parameter_items_by_id"]
        parameter_items_by_param_id = randomization_data["parameter_items_by_param_id"]
        documents_by_id = randomization_data["documents_by_id"]
        
        # Get parameters with document_parameter=true
        doc_params = [p for p in active_parameters if p.get("document_parameter", False)]
        doc_param_ids = {p["id"] for p in doc_params}
        
        # Suggest persona -----------------------------------------------------
        suggested_persona_id = persona_id
        if "persona" in targets_set:
            # Make persona selection fully random among active personas to reduce determinism
            if active_personas:
                persona_dict = random.choice(active_personas)
                suggested_persona_id = uuid.UUID(str(persona_dict["id"]))

        # Suggest documents and parameters with intelligent matching -----------------
        # Determine what needs to be suggested first
        suggest_docs = "documents" in targets_set
        suggest_params = "parameters" in targets_set
        
        # Handle empty list signals
        suggested_document_ids: list[uuid.UUID] = []
        if document_ids is not None and len(document_ids) == 0:
            suggested_document_ids = []
        elif suggest_docs:
            # When randomizing documents, start fresh (don't preserve existing)
            suggested_document_ids = []
        else:
            # When NOT randomizing documents, preserve existing selection
            suggested_document_ids = list(document_ids or [])
        
        # Use a set to track parameter items and prevent duplicates
        # When randomizing parameters, start fresh (don't preserve existing)
        if suggest_params:
            suggested_parameter_item_ids_set: set[uuid.UUID] = set()
        else:
            suggested_parameter_item_ids_set = set(parameter_item_ids or [])
        
        # Respect explicit no-documents signal
        if suggest_docs and document_ids is not None and len(document_ids) == 0:
            suggested_document_ids = []
            return {
                "persona_id": suggested_persona_id,
                "document_ids": suggested_document_ids,
                "parameter_item_ids": list(suggested_parameter_item_ids_set),
            }
        
        # Helper function for fuzzy document scoring
        known_types = [
            "homework", "project", "quiz", "midterm", "lab", "lecture", "syllabus",
        ]
        scenario_text_norm = normalize_text(base_text)
        has_type = {
            t: (t in context_tokens) or (t in scenario_text_norm)
            for t in known_types
        }
        
        def score_doc_fuzzy(doc: dict[str, Any]) -> float:
            """Score document using fuzzy matching."""
            score = 0.0
            name_overlap = context_tokens.intersection(
                set(tokenize(doc.get("name") or ""))
            )
            score += 2.0 * len(name_overlap)
            d_type = (doc.get("type") or "").lower()
            if d_type and has_type.get(d_type, False):
                score += 10.0
            if d_type and d_type in scenario_text_norm:
                score += 3.0
            try:
                file_path = doc.get("file_path")
                if file_path:
                    doc_text = read_document_content_for_similarity(file_path)
                    doc_text = doc_text[:5000]
                    sim = fuzz.token_set_ratio(
                        context_text, normalize_text(doc_text)
                    )
                    score += sim * 0.15
            except Exception:
                pass
            return score
        
        def score_param_item_fuzzy(it: dict[str, Any], param: dict[str, Any]) -> float:
            """Score parameter item using fuzzy matching."""
            score = 0.0
            name_norm = normalize_text(it.get("name", ""))
            desc_norm = normalize_text(it.get("description", ""))
            value_norm = normalize_text(it.get("value", ""))
            
            name_tokens = set(tokenize(name_norm))
            desc_tokens = set(tokenize(desc_norm))
            value_tokens = set(tokenize(value_norm))
            p_tokens = set(tokenize(param.get("name", ""))) | set(
                tokenize(param.get("description", ""))
            )
            
            score += 2.0 * len(name_tokens & context_tokens)
            score += 2.0 * len(desc_tokens & context_tokens)
            score += 6.0 * len(value_tokens & context_tokens)
            score += 1.5 * len(p_tokens & context_tokens)
            
            if value_norm and value_norm in context_text:
                score += 25.0
            
            sim_all = float(
                fuzz.token_set_ratio(
                    context_text,
                    normalize_text(f"{it.get('name', '')} {it.get('description', '')} {it.get('value', '')}"),
                )
            )
            sim_value = float(fuzz.token_set_ratio(context_text, value_norm))
            score += sim_all * 0.06
            score += sim_value * 0.20
            score += random.random() * 0.75
            return score
        
        # If we need to suggest both documents and parameters, do intelligent matching
        if suggest_docs and suggest_params:
            # Get current state
            current_doc_ids = {d for d in (document_ids or [])}
            current_param_item_ids = suggested_parameter_item_ids_set.copy()
            
            # Build a map of parameter_item_id -> parameter_id for efficient lookup
            param_item_to_param: dict[uuid.UUID, uuid.UUID] = {}
            for pi_id, pi_data in parameter_items_by_id.items():
                if pi_id in current_param_item_ids:
                    param_item_to_param[pi_id] = pi_data["parameter_id"]
            
            # Priority 1: Ensure one-to-one connection for document_parameter=true parameters
            # For each parameter with document_parameter=true, ensure we have matching doc/param_item pair
            for doc_param in doc_params:
                param_id = doc_param["id"]
                # Get parameter items for this document_parameter parameter from lookup map
                param_items = parameter_items_by_param_id.get(param_id, [])
                
                if not param_items:
                    continue
                
                # Check if we already have a parameter_item for this parameter
                existing_item_for_param = None
                for existing_param_item_id in current_param_item_ids:
                    # Check if this item belongs to this parameter
                    if existing_param_item_id in param_item_to_param:
                        if param_item_to_param[existing_param_item_id] == param_id:
                            # Find the full item details from lookup map
                            if existing_param_item_id in parameter_items_by_id:
                                existing_item_for_param = parameter_items_by_id[existing_param_item_id]
                                break
                
                if existing_item_for_param:
                    # We have a parameter_item, find matching document via junction
                    item_id = existing_item_for_param["id"]
                    matching_docs = [
                        documents_by_id[j["document_id"]]
                        for j in document_parameter_items_junction
                        if j["parameter_item_id"] == item_id
                    ]
                    
                    if matching_docs:
                        # Add matching document if not already present
                        # But ensure it shares common parameter_item_ids with already selected documents
                        best_doc = None
                        for doc in matching_docs:
                            if doc["id"] not in current_doc_ids:
                                # If we already have documents, check if this doc shares common parameter_item_ids
                                if suggested_document_ids:
                                    # Build set of parameter_item_ids for already selected docs
                                    selected_param_items: set[uuid.UUID] = set()
                                    for junction in document_parameter_items_junction:
                                        if junction["document_id"] in suggested_document_ids:
                                            selected_param_items.add(junction["parameter_item_id"])
                                    
                                    # Check if this doc shares at least one common parameter_item_id
                                    doc_param_items = {
                                        j["parameter_item_id"]
                                        for j in document_parameter_items_junction
                                        if j["document_id"] == doc["id"]
                                    }
                                    
                                    if not selected_param_items.intersection(doc_param_items):
                                        # This doc doesn't share common parameter_item_ids - skip it
                                        continue
                                
                                if best_doc is None or score_doc_fuzzy(doc) > score_doc_fuzzy(best_doc):
                                    best_doc = doc
                        if best_doc:
                            suggested_document_ids.append(best_doc["id"])
                            current_doc_ids.add(best_doc["id"])
                else:
                    # We don't have a parameter_item yet, but might have documents
                    # Find best matching param_item -> document pair
                    best_match_score = -1.0
                    best_item = None
                    best_doc = None
                    
                    for item in param_items:
                        item_id = item["id"]
                        # Find matching documents via junction
                        matching_docs = [
                            documents_by_id[j["document_id"]]
                            for j in document_parameter_items_junction
                            if j["parameter_item_id"] == item_id
                        ]
                        
                        if matching_docs:
                            for doc in matching_docs:
                                # Score based on fuzzy matching for both
                                item_score = score_param_item_fuzzy(item, doc_param)
                                doc_score = score_doc_fuzzy(doc)
                                combined_score = item_score + doc_score
                                
                                if combined_score > best_match_score:
                                    best_match_score = combined_score
                                    best_item = item
                                    best_doc = doc
                    
                    if best_item and best_doc:
                        # If we already have documents, ensure this doc shares common parameter_item_ids
                        if suggested_document_ids:
                            # Build set of parameter_item_ids for already selected docs (use different name to avoid conflict)
                            selected_param_items_retry: set[uuid.UUID] = set()
                            for junction in document_parameter_items_junction:
                                if junction["document_id"] in suggested_document_ids:
                                    selected_param_items_retry.add(junction["parameter_item_id"])
                            
                            # Check if this doc shares at least one common parameter_item_id
                            # Include the new parameter_item_id we're about to add
                            doc_param_items_retry = {
                                j["parameter_item_id"]
                                for j in document_parameter_items_junction
                                if j["document_id"] == best_doc["id"]
                            }
                            doc_param_items_retry.add(best_item["id"])  # Include the new item we're adding
                            
                            if not selected_param_items_retry.intersection(doc_param_items_retry):
                                # This doc doesn't share common parameter_item_ids - skip it
                                # Try to find a better match that shares common parameter_item_ids
                                best_match_score_retry = -1.0
                                best_item_retry = None
                                best_doc_retry = None
                                
                                for item in param_items:
                                    item_id = item["id"]
                                    matching_docs = [
                                        documents_by_id[j["document_id"]]
                                        for j in document_parameter_items_junction
                                        if j["parameter_item_id"] == item_id
                                    ]
                                    
                                    for doc in matching_docs:
                                        if doc["id"] in current_doc_ids:
                                            continue
                                        
                                        # Check if this doc shares common parameter_item_ids
                                        doc_param_items_check_retry = {
                                            j["parameter_item_id"]
                                            for j in document_parameter_items_junction
                                            if j["document_id"] == doc["id"]
                                        }
                                        doc_param_items_check_retry.add(item_id)
                                        
                                        if selected_param_items_retry.intersection(doc_param_items_check_retry):
                                            # This doc shares common parameter_item_ids - consider it
                                            item_score = score_param_item_fuzzy(item, doc_param)
                                            doc_score = score_doc_fuzzy(doc)
                                            combined_score = item_score + doc_score
                                            
                                            if combined_score > best_match_score_retry:
                                                best_match_score_retry = combined_score
                                                best_item_retry = item
                                                best_doc_retry = doc
                                
                                # If we found a better match, use it; otherwise skip
                                if best_item_retry and best_doc_retry:
                                    best_item = best_item_retry
                                    best_doc = best_doc_retry
                                else:
                                    # No valid match found - skip adding this document/parameter pair
                                    continue
                        
                        # Add to set to prevent duplicates
                        if best_item["id"] not in suggested_parameter_item_ids_set:
                            suggested_parameter_item_ids_set.add(best_item["id"])
                            current_param_item_ids.add(best_item["id"])
                        if best_doc["id"] not in current_doc_ids:
                            suggested_document_ids.append(best_doc["id"])
                            current_doc_ids.add(best_doc["id"])
            
            # Update param_item_to_param map with newly suggested items
            for pi_id in suggested_parameter_item_ids_set:
                if pi_id in parameter_items_by_id:
                    param_item_to_param[pi_id] = parameter_items_by_id[pi_id]["parameter_id"]
            
            # Priority 2: Match via document_parameter_items junction for remaining parameters
            # Handle remaining parameters (non-document_parameter ones or ones not yet matched)
            for param in active_parameters:
                # Skip if already handled in Priority 1
                if param["id"] in doc_param_ids:
                    # Check if we already have an item for this parameter using the map
                    has_item = False
                    for existing_item_id in suggested_parameter_item_ids_set:
                        if existing_item_id in param_item_to_param:
                            if param_item_to_param[existing_item_id] == param["id"]:
                                has_item = True
                                break
                    if has_item:
                        continue
                
                # Get items for this parameter from lookup map
                items = parameter_items_by_param_id.get(param["id"], [])
                
                if not items:
                    continue
                
                # If we have documents, try to match via junction
                if suggested_document_ids:
                    # Find parameter items linked to suggested documents via junction
                    suggested_doc_ids_set = set(suggested_document_ids)
                    matching_items = [
                        parameter_items_by_id[j["parameter_item_id"]]
                        for j in document_parameter_items_junction
                        if j["document_id"] in suggested_doc_ids_set
                        and j["parameter_item_id"] in parameter_items_by_id
                    ]
                    
                    # Filter to items for this parameter
                    param_matching_items = [
                        it for it in matching_items
                        if it["parameter_id"] == param["id"]
                    ]
                    
                    if param_matching_items:
                        # Score and pick best matching item
                        best_item = max(param_matching_items, key=lambda it: score_param_item_fuzzy(it, param))
                        if best_item["id"] not in suggested_parameter_item_ids_set:
                            suggested_parameter_item_ids_set.add(best_item["id"])
                        continue
                
                # Priority 3: Fuzzy matching
                ranked_items = sorted(items, key=lambda it: score_param_item_fuzzy(it, param), reverse=True)
                top_pool = ranked_items[: min(5, len(ranked_items))]
                if top_pool:
                    chosen_item = random.choice(top_pool)
                    if chosen_item["id"] not in suggested_parameter_item_ids_set:
                        suggested_parameter_item_ids_set.add(chosen_item["id"])
            
            # Priority 2: For documents, match via document_parameter_items junction
            if suggest_docs and len(suggested_document_ids) == len(document_ids or []):
                # We haven't added any new documents yet, try matching via junction
                if suggested_parameter_item_ids_set:
                    # Find documents linked to suggested parameter items via junction
                    matching_docs = [
                        documents_by_id[j["document_id"]]
                        for j in document_parameter_items_junction
                        if j["parameter_item_id"] in suggested_parameter_item_ids_set
                        and j["document_id"] in documents_by_id
                    ]
                    
                    if matching_docs:
                        # Filter out already selected documents
                        available_docs = [d for d in matching_docs if d["id"] not in current_doc_ids]
                        if available_docs:
                            best_doc = max(available_docs, key=score_doc_fuzzy)
                            suggested_document_ids.append(best_doc["id"])
                            current_doc_ids.add(best_doc["id"])
            
            # Priority 3: Fuzzy matching for documents (if still needed)
            if suggest_docs and len(suggested_document_ids) == len(document_ids or []):
                available_docs_both = [d for d in active_documents if d["id"] not in current_doc_ids]
                if available_docs_both:
                    tag_to_docs_both: dict[str, list[dict[str, Any]]] = {}
                    for d in available_docs_both:
                        tags = ["__untagged__"]
                        for t in tags:
                            tag_to_docs_both.setdefault(t, []).append(d)
                    
                    tag_scores_both: list[tuple[str, float]] = []
                    for t, docs in tag_to_docs_both.items():
                        best = max((score_doc_fuzzy(d) for d in docs), default=0.0)
                        tag_scores_both.append((t, best + random.random() * 0.1))
                    
                    chosen_tag = weighted_choice(tag_scores_both) or (
                        tag_scores_both[0][0] if tag_scores_both else "__untagged__"
                    )
                    candidates = tag_to_docs_both.get(chosen_tag, [])
                    cand_scores = [score_doc_fuzzy(d) for d in candidates]
                    selected = weighted_sample_without_replacement(candidates, cand_scores, 1)
                    if selected:
                        suggested_document_ids.append(selected[0]["id"])
        
        elif suggest_docs:
            # Only suggesting documents
            if document_ids and not parameter_item_ids:
                # We have documents but no parameters - pick parameter items that match documents
                doc_ids_set = set(document_ids)
                matching_items = [
                    parameter_items_by_id[j["parameter_item_id"]]
                    for j in document_parameter_items_junction
                    if j["document_id"] in doc_ids_set
                    and j["parameter_item_id"] in parameter_items_by_id
                ]
                
                # Group by parameter and pick one item per parameter
                items_by_param: dict[uuid.UUID, list[dict[str, Any]]] = {}
                for it in matching_items:
                    param_id = it["parameter_id"]
                    if param_id not in items_by_param:
                        items_by_param[param_id] = []
                    items_by_param[param_id].append(it)
                
                for param in active_parameters:
                    param_id = param["id"]
                    if param_id in items_by_param:
                        items = items_by_param[param_id]
                        best_item = max(items, key=lambda it: score_param_item_fuzzy(it, param))
                        if best_item["id"] not in suggested_parameter_item_ids_set:
                            suggested_parameter_item_ids_set.add(best_item["id"])
            
            # Priority 2: Match via junction if we have parameter items
            if parameter_item_ids:
                param_item_ids_set = set(parameter_item_ids)
                matching_docs = [
                    documents_by_id[j["document_id"]]
                    for j in document_parameter_items_junction
                    if j["parameter_item_id"] in param_item_ids_set
                    and j["document_id"] in documents_by_id
                ]
                
                if matching_docs:
                    available_docs = [d for d in matching_docs if d["id"] not in (document_ids or [])]
                    if available_docs:
                        # If we already have documents, only add documents that share common parameter_item_ids
                        if suggested_document_ids:
                            # Build map of document_id -> parameter_item_ids for already selected docs
                            selected_doc_param_items: dict[uuid.UUID, set[uuid.UUID]] = {}
                            for junction in document_parameter_items_junction:
                                if junction["document_id"] in suggested_document_ids:
                                    if junction["document_id"] not in selected_doc_param_items:
                                        selected_doc_param_items[junction["document_id"]] = set()
                                    selected_doc_param_items[junction["document_id"]].add(junction["parameter_item_id"])
                            
                            # Find common parameter_item_ids across all selected documents
                            if selected_doc_param_items:
                                common_param_items = set.intersection(*selected_doc_param_items.values())
                                
                                # Only add documents that share at least one common parameter_item_id
                                if common_param_items:
                                    valid_docs = [
                                        d for d in available_docs
                                        if d["id"] in documents_by_id
                                        and any(
                                            j["document_id"] == d["id"] and j["parameter_item_id"] in common_param_items
                                            for j in document_parameter_items_junction
                                        )
                                    ]
                                    if valid_docs:
                                        best_doc = max(valid_docs, key=score_doc_fuzzy)
                                        suggested_document_ids.append(best_doc["id"])
                                else:
                                    # Selected documents don't share common parameter_item_ids - don't add more
                                    pass
                            else:
                                # No parameter_item_ids for selected docs - don't add more
                                pass
                        else:
                            # No documents selected yet - add only ONE best matching document
                            # to avoid having multiple documents that don't share common parameter_item_ids
                            best_doc = max(available_docs, key=score_doc_fuzzy)
                            suggested_document_ids.append(best_doc["id"])
                            # Don't add more documents here - let validation handle it if needed
            
            # Priority 3: Fuzzy matching - only add if we don't already have a document
            # (because we need to ensure documents share common parameter_item_ids)
            if len(suggested_document_ids) == 0:
                available_docs_only = [d for d in active_documents if d["id"] not in (document_ids or [])]
                if available_docs_only:
                    tag_to_docs_only: dict[str, list[dict[str, Any]]] = {}
                    for d in available_docs_only:
                        tags = ["__untagged__"]
                        for t in tags:
                            tag_to_docs_only.setdefault(t, []).append(d)
                    
                    tag_scores_only: list[tuple[str, float]] = []
                    for t, docs in tag_to_docs_only.items():
                        best = max((score_doc_fuzzy(d) for d in docs), default=0.0)
                        tag_scores_only.append((t, best + random.random() * 0.1))
                    
                    chosen_tag = weighted_choice(tag_scores_only) or (
                        tag_scores_only[0][0] if tag_scores_only else "__untagged__"
                    )
                    candidates = tag_to_docs_only.get(chosen_tag, [])
                    cand_scores = [score_doc_fuzzy(d) for d in candidates]
                    selected = weighted_sample_without_replacement(candidates, cand_scores, 1)
                    if selected:
                        suggested_document_ids.append(selected[0]["id"])
        
        elif suggest_params:
            # Only suggesting parameters
            if parameter_item_ids and not document_ids:
                # We have parameter items but no documents - pick documents that match parameter items
                param_item_ids_set = set(parameter_item_ids)
                matching_docs = [
                    documents_by_id[j["document_id"]]
                    for j in document_parameter_items_junction
                    if j["parameter_item_id"] in param_item_ids_set
                    and j["document_id"] in documents_by_id
                ]
                
                if matching_docs:
                    best_doc = max(matching_docs, key=score_doc_fuzzy)
                    suggested_document_ids.append(best_doc["id"])
            
            # Process each parameter - ensure only one item per parameter
            for param in active_parameters:
                # Check if we already have an item for this parameter
                has_item_for_param = False
                for existing_item_id in suggested_parameter_item_ids_set:
                    if existing_item_id in parameter_items_by_id:
                        if parameter_items_by_id[existing_item_id]["parameter_id"] == param["id"]:
                            has_item_for_param = True
                            break
                
                # Skip if we already have an item for this parameter
                if has_item_for_param:
                    continue
                
                # Get items for this parameter from lookup map
                items = parameter_items_by_param_id.get(param["id"], [])
                
                if not items:
                    continue
                
                # Priority 2: Match via junction if we have documents
                if document_ids:
                    doc_ids_set = set(document_ids)
                    matching_items = [
                        parameter_items_by_id[j["parameter_item_id"]]
                        for j in document_parameter_items_junction
                        if j["document_id"] in doc_ids_set
                        and j["parameter_item_id"] in parameter_items_by_id
                    ]
                    
                    param_matching_items = [
                        it for it in matching_items
                        if it["parameter_id"] == param["id"]
                    ]
                    
                    if param_matching_items:
                        best_item = max(param_matching_items, key=lambda it: score_param_item_fuzzy(it, param))
                        if best_item["id"] not in suggested_parameter_item_ids_set:
                            suggested_parameter_item_ids_set.add(best_item["id"])
                        continue
                
                # Priority 3: Fuzzy matching
                ranked_items = sorted(items, key=lambda it: score_param_item_fuzzy(it, param), reverse=True)
                top_pool = ranked_items[: min(5, len(ranked_items))]
                if top_pool:
                    chosen_item = random.choice(top_pool)
                    if chosen_item["id"] not in suggested_parameter_item_ids_set:
                        suggested_parameter_item_ids_set.add(chosen_item["id"])

        # Ensure documents are suggested if suggest_docs is true and we haven't added any
        # Note: We don't add fallback documents here if we already have documents, because
        # the validation below will ensure documents share common parameter_item_ids
        if suggest_docs and len(suggested_document_ids) == 0 and len(document_ids or []) == 0:
            # Fallback: try to add at least one document if none were added
            available_docs_fallback = [d for d in active_documents if d["id"] not in (document_ids or [])]
            if available_docs_fallback:
                # Pick best matching document
                best_doc = max(available_docs_fallback, key=score_doc_fuzzy)
                suggested_document_ids.append(best_doc["id"])
        
        # Validate that all suggested documents share at least one common parameter_item_id
        if len(suggested_document_ids) > 1:
            # Build map of document_id -> set of parameter_item_ids
            doc_to_param_items: dict[uuid.UUID, set[uuid.UUID]] = {}
            for junction in document_parameter_items_junction:
                doc_id = junction["document_id"]
                param_item_id = junction["parameter_item_id"]
                if doc_id not in doc_to_param_items:
                    doc_to_param_items[doc_id] = set()
                doc_to_param_items[doc_id].add(param_item_id)
            
            # Check if all documents share at least one common parameter_item_id
            # suggested_document_ids contains UUID objects
            doc_ids_uuid = [d for d in suggested_document_ids if isinstance(d, uuid.UUID)]
            
            if doc_ids_uuid:
                # Get parameter_item_ids for each document (only include documents that have parameter_item_ids)
                param_item_sets: list[tuple[uuid.UUID, set[uuid.UUID]]] = [
                    (doc_id, doc_to_param_items[doc_id])
                    for doc_id in doc_ids_uuid
                    if doc_id in doc_to_param_items and len(doc_to_param_items[doc_id]) > 0
                ]
                
                # Filter to only documents that have parameter_item_ids
                valid_doc_ids = [doc_id for doc_id, _ in param_item_sets]
                
                if len(valid_doc_ids) == 0:
                    # No documents have parameter_item_ids - keep only the first document
                    logger.warning(
                        f"None of the selected documents {suggested_document_ids} have parameter_item_ids. "
                        f"Keeping only the first document: {suggested_document_ids[0]}"
                    )
                    suggested_document_ids = [doc_ids_uuid[0]]
                elif len(valid_doc_ids) == 1:
                    # Only one document has parameter_item_ids - that's fine
                    suggested_document_ids = valid_doc_ids
                else:
                    # Multiple documents with parameter_item_ids - check if they share common ones
                    param_item_set_values = [param_set for _, param_set in param_item_sets]
                    # Find intersection of all sets
                    common_items = param_item_set_values[0]
                    for param_items in param_item_set_values[1:]:
                        common_items = common_items.intersection(param_items)
                    
                    # If no common parameter_item_ids, keep only the first document
                    if len(common_items) == 0:
                        logger.warning(
                            f"Selected documents {valid_doc_ids} don't share common parameter_item_ids. "
                            f"Keeping only the first document: {valid_doc_ids[0]}"
                        )
                        suggested_document_ids = [valid_doc_ids[0]]
                    else:
                        # Documents share common parameter_item_ids - that's valid
                        suggested_document_ids = valid_doc_ids
        
        # Ensure we only have one parameter item per parameter when randomizing
        if suggest_params:
            # Group suggested items by parameter_id
            param_to_items: dict[uuid.UUID, list[uuid.UUID]] = {}
            for item_id in suggested_parameter_item_ids_set:
                if item_id in parameter_items_by_id:
                    param_id = parameter_items_by_id[item_id]["parameter_id"]
                    if param_id not in param_to_items:
                        param_to_items[param_id] = []
                    param_to_items[param_id].append(item_id)
            
            # Keep only one item per parameter (prefer the first one added)
            final_param_item_ids: set[uuid.UUID] = set()
            for param_id, item_ids in param_to_items.items():
                if item_ids:
                    # Keep the first item for this parameter
                    final_param_item_ids.add(item_ids[0])
            
            suggested_parameter_item_ids_set = final_param_item_ids

        return {
            "persona_id": suggested_persona_id,
            "document_ids": suggested_document_ids,
            "parameter_item_ids": list(suggested_parameter_item_ids_set),
        }

    @with_cache(lambda self, query, limit: keys.scenario_search(query, limit))
    async def search_scenarios(
        self, query: str, limit: int = 10
    ) -> list[dict[str, Any]]:
        """
        Fuzzy search scenarios by name and problem_statement.
        Returns scored and sorted results.

        Args:
            query: Search query string
            limit: Maximum number of results to return

        Returns:
            List of scenario dictionaries with scores
        """
        q_norm = normalize_text(query)
        if not q_norm:
            return []

        toks = tokenize(query)

        # Build fuzzy search conditions
        where_clause, params, param_idx = build_fuzzy_conditions(
            ["s.name", "sps.problem_statement"], query
        )

        # Build and execute query
        query_template, _ = self.queries.search_scenarios_fuzzy(where_clause, limit * 5)
        # Replace placeholder with actual param index
        sql = query_template.replace("{param_count}", str(param_idx))
        params.append(limit * 5)  # Candidate pool

        scenarios = await self.conn.fetch(sql, *params)

        if not scenarios:
            return []

        # Score and build results (persona_id now included in main query)
        results = []
        for sc in scenarios:
            score = self._score_scenario(
                q_norm, toks, sc["name"], sc["problem_statement"]
            )
            results.append(
                {
                    "id": str(sc["id"]),
                    "name": sc["name"],
                    "problem_statement": sc["problem_statement"],
                    "persona_id": str(sc["persona_id"]) if sc["persona_id"] else None,
                    "score": score,
                }
            )

        # Sort by score (descending) then name
        results.sort(key=lambda r: (-r["score"], r["name"] or ""))
        return results[:limit]

    def _score_scenario(
        self, q_norm: str, toks: list[str], name: str | None, desc: str | None
    ) -> int:
        """
        Score scenario relevance. Name carries more weight than problem_statement.

        Args:
            q_norm: Normalized query string
            toks: Query tokens
            name: Scenario name
            desc: Scenario problem_statement/description

        Returns:
            Relevance score (higher is better)
        """
        n_norm = normalize_text(name or "")
        d_norm = normalize_text(desc or "")
        score = 0

        # Exact matches
        if n_norm == q_norm:
            score += 100
        if d_norm == q_norm:
            score += 40

        # Prefix boosts
        if n_norm.startswith(q_norm):
            score += 60
        if d_norm.startswith(q_norm):
            score += 20

        # Token boosts
        for tok in toks:
            if n_norm.startswith(tok):
                score += 25
            if tok in n_norm:
                score += 10
            if d_norm.startswith(tok):
                score += 8
            if tok in d_norm:
                score += 4

        # Contains boost
        if q_norm in n_norm or q_norm in d_norm:
            score += 5

        # Length proximity bonus
        gap = abs(len(n_norm) - len(q_norm))
        score += max(0, 10 - gap)

        return score

    # ===== Overview Methods for MCP Tools =====

    @with_cache(lambda self, scenario_id: keys.scenario_overview(scenario_id))
    async def get_scenario_overview(self, scenario_id: str) -> dict[str, Any]:
        """Get scenario overview with all related data in ONE optimized query.

        Returns scenario details, associated simulations, and persona.

        Args:
            scenario_id: UUID string of the scenario

        Returns:
            Dict with scenario overview data or {"error": "..."}
        """
        import uuid

        try:
            scenario_uuid = uuid.UUID(scenario_id)
        except ValueError:
            return {"error": f"Invalid scenario_id format: {scenario_id}"}

        try:
            query, params = self.queries.get_scenario_overview_complete(scenario_uuid)
            result = await self.conn.fetchrow(query, *params)

            if not result:
                return {"error": f"Scenario not found: {scenario_id}"}

            # Transform simulations (jsonb array to list of dicts)
            simulation_list = []
            for sim in result["simulations"]:
                simulation_list.append(
                    {
                        "id": str(sim["id"]),
                        "title": sim["title"],
                        "active": sim["active"],
                        "time_limit": sim["time_limit"],
                        "created_at": sim["created_at"]
                        if sim.get("created_at")
                        else None,
                    }
                )

            return {
                "id": str(result["id"]),
                "name": result["name"],
                "problem_statement": result["problem_statement"],
                "persona_id": str(result["persona_id"])
                if result["persona_id"]
                else None,
                "created_at": result["created_at"].isoformat()
                if result["created_at"]
                else None,
                "updated_at": result["updated_at"].isoformat()
                if result["updated_at"]
                else None,
                "simulations": simulation_list,
                "simulation_count": len(simulation_list),
            }

        except Exception as e:
            return {"error": f"Database error: {str(e)}"}


def get_scenario_service(conn: asyncpg.Connection) -> ScenarioService:
    """Get scenario service instance."""
    return ScenarioService(conn)
