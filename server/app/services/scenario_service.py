"""Scenario service layer - business logic for scenario operations."""

import uuid
from typing import Any, Dict, List, Optional, Tuple

import asyncpg  # type: ignore
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
                                   DeleteScenarioResponse,
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


class ScenarioService:
    """Service layer for scenario operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database session."""
        self.conn = conn
        self.queries = ScenarioQueries()

    async def build_enhanced_scenario_mapping(
        self, scenario_ids: List[str]
    ) -> Dict[str, ScenarioMappingItem]:
        """Build enhanced scenario mapping with nested persona, document, and parameter data."""
        if not scenario_ids:
            return {}

        # Get base scenario data with persona_id and parameter_item_ids
        query, params = self.queries.get_enhanced_scenario_mapping(scenario_ids)
        scenario_result = await self.conn.fetch(query, *params)

        # Collect all IDs we need to fetch
        all_persona_ids = list(set([str(row['persona_id']) for row in scenario_result if row['persona_id']]))
        all_parameter_item_ids = list(set([
            str(pid) for row in scenario_result 
            for pid in (row['parameter_item_ids'] or [])
        ]))

        # Get document IDs for each scenario
        scenario_document_map: Dict[str, List[str]] = {}
        if scenario_ids:
            doc_result = await self.conn.fetch("""
                SELECT scenario_id, ARRAY_AGG(document_id) as document_ids
                FROM scenario_documents
                WHERE scenario_id = ANY($1::uuid[]) AND active = true
                GROUP BY scenario_id
            """, scenario_ids)
            for row in doc_result:
                scenario_document_map[str(row['scenario_id'])] = [str(did) for did in (row['document_ids'] or [])]

        all_document_ids = list(set([
            did for doc_ids in scenario_document_map.values() for did in doc_ids
        ]))

        # Fetch persona mapping
        persona_mapping = {}
        if all_persona_ids:
            query, params = self.queries.get_persona_mapping(all_persona_ids)
            persona_result = await self.conn.fetch(query, *params)
            for row in persona_result:
                persona_mapping[str(row['id'])] = PersonaMappingItem(
                    name=row['name'],
                    description=row['description'] or '',
                    color=row['color'],
                    icon=row['icon']
                )

        # Fetch document mapping
        document_mapping = {}
        if all_document_ids:
            doc_mapping_result = await self.conn.fetch("""
                SELECT id, name, type::text as description
                FROM documents
                WHERE id = ANY($1::uuid[])
            """, all_document_ids)
            for row in doc_mapping_result:
                document_mapping[str(row['id'])] = DocumentMappingItem(
                    name=row['name'],
                    description=row['description']
                )

        # Fetch parameter_item mapping
        parameter_item_mapping = {}
        if all_parameter_item_ids:
            query, params = self.queries.get_parameter_item_mapping(all_parameter_item_ids)
            param_item_result = await self.conn.fetch(query, *params)
            for row in param_item_result:
                parameter_item_mapping[str(row['id'])] = ParameterItemMappingItem(
                    name=row['name'],
                    description=row['description'] or '',
                    parameter_id=str(row['parameter_id']),
                    parameter_name=row['parameter_name']
                )

        # Build the final mapping
        enhanced_mapping = {}
        for row in scenario_result:
            scenario_id = str(row['scenario_id'])
            parameter_item_ids = [str(pid) for pid in (row['parameter_item_ids'] or [])]
            document_ids = scenario_document_map.get(scenario_id, [])

            # Filter mappings to only include relevant items for this scenario
            scenario_persona_mapping = {}
            if row['persona_id']:
                persona_id_str = str(row['persona_id'])
                if persona_id_str in persona_mapping:
                    scenario_persona_mapping[persona_id_str] = persona_mapping[persona_id_str]

            scenario_document_mapping = {
                did: document_mapping[did] for did in document_ids if did in document_mapping
            }

            scenario_parameter_item_mapping = {
                pid: parameter_item_mapping[pid] for pid in parameter_item_ids if pid in parameter_item_mapping
            }

            enhanced_mapping[scenario_id] = ScenarioMappingItem(
                name=row['name'],
                description=row['description'],
                persona_id=str(row['persona_id']) if row['persona_id'] else None,
                persona_mapping=scenario_persona_mapping,
                document_mapping=scenario_document_mapping,
                parameter_item_mapping=scenario_parameter_item_mapping,
                parameter_item_ids=parameter_item_ids
            )

        return enhanced_mapping

    async def get_scenarios_list(
        self, filters: ScenariosFilters
    ) -> ScenariosListResponse:
        """Get scenarios list with all relationships using dynamic SQL."""

        # Get query from query builder
        query, params = self.queries.list_scenarios(
            filters.departmentIds, filters.profileId
        )

        result = await self.conn.fetch(query, *params)

        # Build response
        scenarios = []
        objective_mapping = {}
        parameter_item_mapping = {}
        cohort_mapping = {}
        persona_mapping = {}

        for row in result:
            objective_ids = row['objective_ids'] or []
            parameter_item_ids = [str(pid) for pid in (row['parameter_item_ids'] or [])]
            simulation_ids = [str(sid) for sid in (row['simulation_ids'] or [])]
            cohort_ids = [str(cid) for cid in (row['cohort_ids'] or [])]

            scenarios.append(
                ScenarioItem(
                    scenario_id=str(row['scenario_id']),
                    title=row['title'],
                    problem_statement=row['problem_statement'],
                    active=row['active'],
                    default_scenario=row['default_scenario'],
                    generated=row['generated'],
                    parent_scenario_id=row['parent_scenario_id'],
                    objective_ids=objective_ids,
                    persona_id=str(row['persona_id']) if row['persona_id'] else None,
                    parameter_item_ids=parameter_item_ids,
                    simulation_ids=simulation_ids,
                    num_simulations=row['num_simulations'],
                    can_edit=row['can_edit'],
                    can_delete=row['can_delete'],
                    can_duplicate=row['can_duplicate'],
                    cohort_ids=cohort_ids,
                )
            )

        # Get objective names for mapping
        if objective_ids_to_fetch := list(
            set([oid for s in scenarios for oid in s.objective_ids])
        ):
            # Parse composite keys
            obj_parts = [oid.split("_") for oid in objective_ids_to_fetch]
            scenario_idx_pairs = [
                (parts[0], int(parts[1])) for parts in obj_parts if len(parts) == 2
            ]

            if scenario_idx_pairs:
                scenario_ids = [pair[0] for pair in scenario_idx_pairs]
                idxs = [pair[1] for pair in scenario_idx_pairs]

                query, params = self.queries.get_objective_mapping(scenario_ids, idxs)
                obj_result = await self.conn.fetch(query, *params)

                for row in obj_result:
                    objective_mapping[row['objective_id']] = ObjectiveMappingItem(
                        name=row['objective'],
                        description=row['objective']
                    )

        # Get parameter_item names for mapping
        if parameter_item_ids_to_fetch := list(
            set([pid for s in scenarios for pid in s.parameter_item_ids])
        ):
            query, params = self.queries.get_parameter_item_mapping(
                parameter_item_ids_to_fetch
            )
            param_item_result = await self.conn.fetch(query, *params)

            for row in param_item_result:
                parameter_item_mapping[str(row['id'])] = ParameterItemMappingItem(
                    name=row['name'],
                    description=row['description'] or '',
                    parameter_id=str(row['parameter_id']),
                    parameter_name=row['parameter_name']
                )

        # Get cohort names for mapping
        if cohort_ids_to_fetch := list(
            set([cid for s in scenarios for cid in s.cohort_ids])
        ):
            query, params = self.queries.get_cohort_mapping(cohort_ids_to_fetch)
            cohort_result = await self.conn.fetch(query, *params)

            for row in cohort_result:
                cohort_mapping[str(row['id'])] = CohortMappingItem(
                    name=row['name'],
                    description=row['description']
                )

        # Get persona names for mapping
        if persona_ids_to_fetch := list(
            set([s.persona_id for s in scenarios if s.persona_id])
        ):
            query, params = self.queries.get_persona_mapping(persona_ids_to_fetch)
            persona_result = await self.conn.fetch(query, *params)

            for row in persona_result:
                persona_mapping[str(row['id'])] = PersonaMappingItem(
                    name=row['name'],
                    description=row['description'],
                    color=row['color'],
                    icon=row['icon']
                )

        return ScenariosListResponse(
            scenarios=scenarios,
            objective_mapping=objective_mapping,
            parameter_item_mapping=parameter_item_mapping,
            cohort_mapping=cohort_mapping,
            persona_mapping=persona_mapping,
        )

    async def get_scenario_detail(
        self, request: ScenarioDetailRequest
    ) -> ScenarioDetailResponse:
        """Get detailed scenario information using dynamic SQL."""

        # Get scenario basic info including generated and parent_scenario_id
        scenario = await self.conn.fetchrow("""
            SELECT 
                s.name,
                s.problem_statement,
                s.active,
                s.default_scenario,
                s.department_id,
                COALESCE(s.generated, false) as generated,
                st.parent_scenario_id
            FROM scenarios s
            LEFT JOIN scenario_tree st ON st.child_scenario_id = s.id
            WHERE s.id = $1
        """, request.scenarioId)

        if not scenario:
            raise ValueError(f"Scenario not found: {request.scenarioId}")

        # Get persona_id
        persona_result = await self.conn.fetchrow("""
            SELECT persona_id FROM scenario_personas 
            WHERE scenario_id = $1 AND active = true
        """, request.scenarioId)

        persona_id = str(persona_result['persona_id']) if persona_result else None

        # Get document_ids
        document_result = await self.conn.fetch("""
            SELECT document_id FROM scenario_documents 
            WHERE scenario_id = $1 AND active = true
        """, request.scenarioId)

        document_ids = [str(row['document_id']) for row in document_result]

        # Get objective_ids
        obj_result = await self.conn.fetch("""
            SELECT (scenario_id::text || '_' || idx::text) as objective_id, objective
            FROM scenario_objectives
            WHERE scenario_id = $1
            ORDER BY idx
        """, request.scenarioId)

        objective_ids = [row['objective_id'] for row in obj_result]
        objective_mapping = {
            row['objective_id']: ObjectiveMappingItem(name=row['objective'], description=row['objective'])
            for row in obj_result
        }

        # Get parameters grouped by parameter_id
        param_result = await self.conn.fetch("""
            SELECT 
                pi.parameter_id,
                spi.parameter_item_id
            FROM scenario_parameter_items spi
            JOIN parameter_items pi ON pi.id = spi.parameter_item_id
            WHERE spi.scenario_id = $1 AND spi.active = true
        """, request.scenarioId)

        # Group by parameter_id
        parameters_dict: Dict[str, ParameterDetail] = {}
        selected_param_ids = set()

        for row in param_result:
            param_id = str(row['parameter_id'])
            param_item_id = str(row['parameter_item_id'])
            selected_param_ids.add(param_id)

            if param_id not in parameters_dict:
                parameters_dict[param_id] = ParameterDetail(
                    parameter_item_ids=[], valid_parameter_item_ids=[]
                )

            parameters_dict[param_id].parameter_item_ids.append(param_item_id)

        # Get valid parameter items for each parameter
        if selected_param_ids:
            valid_params_result = await self.conn.fetch("""
                SELECT 
                    pi.parameter_id,
                    pi.id as parameter_item_id
                FROM parameter_items pi
                WHERE pi.parameter_id = ANY($1::uuid[]) AND pi.active = true
            """, list(selected_param_ids))

            for row in valid_params_result:
                param_id = str(row['parameter_id'])
                param_item_id = str(row['parameter_item_id'])

                if param_id in parameters_dict:
                    parameters_dict[param_id].valid_parameter_item_ids.append(
                        param_item_id
                    )

        # Get active simulation_ids
        active_simulation_result = await self.conn.fetch("""
            SELECT simulation_id FROM simulation_scenarios 
            WHERE scenario_id = $1 AND active = true
        """, request.scenarioId)

        active_simulation_ids = [str(row['simulation_id']) for row in active_simulation_result]

        # Get user's accessible department IDs
        dept_results = await self.conn.fetch("""
            SELECT DISTINCT d.id
            FROM departments d
            JOIN profile_departments pd ON pd.department_id = d.id
            WHERE pd.profile_id = $1 AND d.active = true
        """, request.profileId)

        dept_ids = [str(row['id']) for row in dept_results]

        # Get valid personas
        persona_results = await self.conn.fetch("""
            SELECT id, name, COALESCE(description, '') as description, color, icon FROM personas 
            WHERE department_id = ANY($1::uuid[]) AND active = true
            ORDER BY name
        """, dept_ids)

        valid_persona_ids = [str(row['id']) for row in persona_results]
        persona_mapping = {
            str(row['id']): PersonaMappingItem(
                name=row['name'],
                description=row['description'],
                color=row['color'],
                icon=row['icon']
            )
            for row in persona_results
        }

        # Get valid documents
        doc_results = await self.conn.fetch("""
            SELECT id, name, type::text as description FROM documents 
            WHERE department_id = ANY($1::uuid[]) AND active = true
            ORDER BY name
        """, dept_ids)

        valid_document_ids = [str(row['id']) for row in doc_results]
        document_mapping = {
            str(row['id']): DocumentMappingItem(name=row['name'], description=row['description'])
            for row in doc_results
        }

        # Get simulation mapping
        simulation_mapping = {}
        if active_simulation_ids:
            sim_mapping_result = await self.conn.fetch("""
                SELECT id, title, COALESCE(description, '') as description FROM simulations WHERE id = ANY($1::uuid[])
            """, active_simulation_ids)

            for row in sim_mapping_result:
                simulation_mapping[str(row['id'])] = SimulationMappingItem(
                    name=row['title'],
                    description=row['description']
                )

        # Get parameter mapping
        parameter_mapping = {}
        all_param_item_ids = list(
            set(
                [
                    pid
                    for param_detail in parameters_dict.values()
                    for pid in param_detail.parameter_item_ids
                    + param_detail.valid_parameter_item_ids
                ]
            )
        )

        if all_param_item_ids:
            param_mapping_result = await self.conn.fetch("""
                SELECT DISTINCT
                    p.id as parameter_id,
                    p.name,
                    p.description
                FROM parameters p
                JOIN parameter_items pi ON pi.parameter_id = p.id
                WHERE pi.id = ANY($1::uuid[])
            """, all_param_item_ids)

            for row in param_mapping_result:
                parameter_mapping[str(row['parameter_id'])] = ParameterMappingItem(
                    name=row['name'],
                    description=row['description'] or ''
                )

        # Get parameter_item mapping (already built above)
        param_item_full_mapping = {}
        if all_param_item_ids:
            param_item_mapping_result = await self.conn.fetch("""
                SELECT 
                    pi.id,
                    pi.name,
                    pi.description,
                    pi.value,
                    pi.parameter_id,
                    p.name as parameter_name
                FROM parameter_items pi
                JOIN parameters p ON p.id = pi.parameter_id
                WHERE pi.id = ANY($1::uuid[])
            """, all_param_item_ids)

            for row in param_item_mapping_result:
                param_item_full_mapping[str(row['id'])] = ParameterItemMappingItem(
                    name=row['name'],
                    description=row['description'] or '',
                    parameter_id=str(row['parameter_id']),
                    parameter_name=row['parameter_name']
                )

        # Compute permissions
        # Check if scenario is in use by active simulations
        active_sim_count_result = await self.conn.fetchrow("""
            SELECT COUNT(*) as usage_count
            FROM simulation_scenarios ss
            JOIN simulations s ON s.id = ss.simulation_id
            WHERE ss.scenario_id = $1 
            AND ss.active = true 
            AND s.active = true
        """, request.scenarioId)
        
        in_use_by_active = (active_sim_count_result['usage_count'] > 0) if active_sim_count_result else False
        is_generated = scenario['generated']
        
        # Get profile role for permissions
        role_result = await self.conn.fetchrow("""
            SELECT role FROM profiles WHERE id = $1
        """, request.profileId)
        
        is_superadmin = role_result['role'] == 'superadmin' if role_result else False
        
        # Compute permission flags
        can_edit = not in_use_by_active and not is_generated
        can_duplicate = True  # Always allowed
        can_delete = not in_use_by_active and is_superadmin

        # Get department mapping
        department_mapping = {}
        if dept_ids:
            dept_mapping_result = await self.conn.fetch("""
                SELECT id, title, COALESCE(description, '') as description 
                FROM departments 
                WHERE id = ANY($1::uuid[])
            """, dept_ids)
            
            for row in dept_mapping_result:
                department_mapping[str(row['id'])] = DepartmentMappingItem(
                    name=row['title'],
                    description=row['description']
                )

        return ScenarioDetailResponse(
            # Basic fields
            name=scenario['name'],
            problem_statement=scenario['problem_statement'],
            active=scenario['active'],
            default_scenario=scenario['default_scenario'],
            generated=is_generated,
            parent_scenario_id=str(scenario['parent_scenario_id']) if scenario['parent_scenario_id'] else None,
            # Department
            department_id=str(scenario['department_id']),
            valid_department_ids=dept_ids,
            # IDs
            persona_id=persona_id,
            valid_persona_ids=valid_persona_ids,
            document_ids=document_ids,
            valid_document_ids=valid_document_ids,
            # Objectives
            objective_ids=objective_ids,
            valid_objectives=[],  # Empty (free-form)
            # Parameters
            parameters=parameters_dict,
            # Simulations
            active_simulation_ids=active_simulation_ids,
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
        )

    async def get_scenario_detail_default(
        self, request: ScenarioDetailDefaultRequest
    ) -> ScenarioDetailResponse:
        """Get default scenario structure for creation mode."""

        # Get user's accessible department IDs
        dept_results = await self.conn.fetch("""
            SELECT DISTINCT d.id
            FROM departments d
            JOIN profile_departments pd ON pd.department_id = d.id
            WHERE pd.profile_id = $1 AND d.active = true
        """, request.profileId)
        
        dept_ids = [str(row['id']) for row in dept_results]
        
        if not dept_ids:
            raise ValueError("No accessible departments found for user")
        
        # Default department (first accessible)
        default_dept_id = dept_ids[0]

        # Get valid personas
        persona_results = await self.conn.fetch("""
            SELECT id, name, COALESCE(description, '') as description, color, icon 
            FROM personas 
            WHERE department_id = ANY($1::uuid[]) AND active = true
            ORDER BY name
        """, dept_ids)

        valid_persona_ids = [str(row['id']) for row in persona_results]
        persona_mapping = {
            str(row['id']): PersonaMappingItem(
                name=row['name'],
                description=row['description'],
                color=row['color'],
                icon=row['icon']
            )
            for row in persona_results
        }

        # Get valid documents
        doc_results = await self.conn.fetch("""
            SELECT id, name, type::text as description 
            FROM documents 
            WHERE department_id = ANY($1::uuid[]) AND active = true
            ORDER BY name
        """, dept_ids)

        valid_document_ids = [str(row['id']) for row in doc_results]
        document_mapping = {
            str(row['id']): DocumentMappingItem(name=row['name'], description=row['description'])
            for row in doc_results
        }

        # Get all parameters for valid departments
        param_results = await self.conn.fetch("""
            SELECT DISTINCT p.id, p.name, p.description
            FROM parameters p
            WHERE p.department_id = ANY($1::uuid[]) AND p.active = true
            ORDER BY p.name
        """, dept_ids)

        parameter_mapping = {
            str(row['id']): ParameterMappingItem(
                name=row['name'],
                description=row['description'] or ''
            )
            for row in param_results
        }

        # Get all parameter items
        param_item_results = await self.conn.fetch("""
            SELECT pi.id, pi.name, pi.description, pi.parameter_id, p.name as parameter_name
            FROM parameter_items pi
            JOIN parameters p ON p.id = pi.parameter_id
            WHERE p.department_id = ANY($1::uuid[]) AND pi.active = true
            ORDER BY p.name, pi.name
        """, dept_ids)

        parameter_item_mapping = {
            str(row['id']): ParameterItemMappingItem(
                name=row['name'],
                description=row['description'] or '',
                parameter_id=str(row['parameter_id']),
                parameter_name=row['parameter_name']
            )
            for row in param_item_results
        }

        # Get department mapping
        department_mapping = {}
        dept_mapping_results = await self.conn.fetch("""
            SELECT id, title, COALESCE(description, '') as description 
            FROM departments 
            WHERE id = ANY($1::uuid[])
        """, dept_ids)
        
        for row in dept_mapping_results:
            department_mapping[str(row['id'])] = DepartmentMappingItem(
                name=row['title'],
                description=row['description']
            )

        # Return empty scenario with all valid options
        return ScenarioDetailResponse(
            # Basic fields (empty defaults)
            name="",
            problem_statement="",
            active=True,
            default_scenario=False,
            generated=False,
            parent_scenario_id=None,
            # Department
            department_id=default_dept_id,
            valid_department_ids=dept_ids,
            # IDs (empty defaults)
            persona_id=None,
            valid_persona_ids=valid_persona_ids,
            document_ids=[],
            valid_document_ids=valid_document_ids,
            # Objectives (empty defaults)
            objective_ids=[],
            valid_objectives=[],
            # Parameters (empty defaults)
            parameters={},
            # Simulations (empty defaults)
            active_simulation_ids=[],
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
        )

    async def create_scenario(
        self, request: CreateScenarioRequest
    ) -> CreateScenarioResponse:
        """Create a new scenario using asyncpg."""

        async with transaction(self.conn):
            # Insert scenario with positional params
            create_query = self.queries.create_scenario()
            result = await self.conn.fetchrow(
                create_query,
                request.name,
                request.problem_statement,
                request.department_id,
                request.active,
                request.default_scenario,
            )

            if not result:
                raise ValueError("Failed to create scenario")

            scenario_id = str(result['id'])

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
                request.problem_statement,
                request.department_id,
                request.active,
                request.default_scenario,
                request.scenarioId,
            )

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

            # Create duplicate with positional params
            insert_query = self.queries.insert_duplicate_scenario()
            new_scenario = await self.conn.fetchrow(
                insert_query,
                original['name'],
                original['problem_statement'],
                original['department_id'],
            )

            if not new_scenario:
                raise ValueError("Failed to create duplicate scenario")

            new_scenario_id = str(new_scenario['id'])

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

            if usage['usage_count'] > 0:
                raise ValueError("Cannot delete scenario that is in use by simulations")

            # Get name for response
            query, params = self.queries.get_scenario_name(request.scenarioId)
            scenario = await self.conn.fetchrow(query, *params)

            if not scenario:
                raise ValueError(f"Scenario not found: {request.scenarioId}")

            # Delete scenario (cascades will handle junction tables)
            query, params = self.queries.delete_scenario(request.scenarioId)
            await self.conn.execute(query, *params)

            return DeleteScenarioResponse(
                success=True, message=f"Scenario '{scenario['name']}' deleted successfully"
            )

    # AI Generation and Randomization Methods
    async def generate_scenario_ai(
        self, request: GenerateScenarioAIRequest
    ) -> GenerateScenarioAIResponse:
        """
        Generate AI scenario content (title, description, objectives).
        Uses the scenario agent to create content based on inputs.
        """
        from app.services.agents.collection.scenario import run_scenario_agent

        # Convert string IDs to UUIDs
        department_id = uuid.UUID(request.departmentId)
        persona_id = uuid.UUID(request.personaId) if request.personaId else None
        document_ids = [uuid.UUID(d) for d in request.documentIds] if request.documentIds else None
        parameter_item_ids = [uuid.UUID(p) for p in request.parameterItemIds] if request.parameterItemIds else None
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
        )

        return GenerateScenarioAIResponse(
            success=True,
            message="Scenario generated successfully",
            title=title,
            description=description,
            objectives=objectives,
        )

    async def randomize_scenario_sections(
        self, request: RandomizeScenarioRequest
    ) -> RandomizeScenarioResponse:
        """
        Suggest randomized persona/documents/parameters based on current inputs.
        """
        from app.utils.scenario import suggest_randomized_sections

        # Convert string IDs to UUIDs
        persona_id = uuid.UUID(request.personaId) if request.personaId else None
        document_ids = [uuid.UUID(d) for d in request.documentIds] if request.documentIds else None
        parameter_item_ids = [uuid.UUID(p) for p in request.parameterItemIds] if request.parameterItemIds else None

        # Normalize empty lists
        if document_ids:
            document_ids = [d for d in document_ids if d]
        if parameter_item_ids:
            parameter_item_ids = [p for p in parameter_item_ids if p]
        targets = [t for t in request.targets if t.strip()] if request.targets else []

        # Get suggestions
        suggestions = await suggest_randomized_sections(
            name=request.name,
            description=request.description,
            persona_id=persona_id,
            document_ids=document_ids,
            parameter_item_ids=parameter_item_ids,
            targets=targets,
            conn=self.conn,
        )

        return RandomizeScenarioResponse(
            success=True,
            message="Randomization suggestions generated",
            personaId=str(suggestions["persona_id"]) if suggestions.get("persona_id") else None,
            documentIds=[str(x) for x in (suggestions.get("document_ids") or [])],
            parameterItemIds=[str(x) for x in (suggestions.get("parameter_item_ids") or [])],
        )

