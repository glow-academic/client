"""Simulation service layer - business logic for simulation operations."""

from typing import Any, Dict, List

import asyncpg  # type: ignore
from app.cache import keys
from app.db import transaction
from app.extensions import get_query_client
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
from app.services.base import BaseService, with_cache
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
        scenario_mapping: Dict[str, ScenarioMappingItem] = {}
        rubric_mapping: RubricMapping = {}

        for row in result:
            # Convert UUID arrays to string arrays
            scenario_ids = [str(sid) for sid in (row['scenario_ids'] or [])]

            simulations.append(
                SimulationItem(
                    simulation_id=str(row['simulation_id']),
                    name=row['name'],
                    description=row['description'],
                    time_limit=row['time_limit'],
                    active=row['active'],
                    default_simulation=row['default_simulation'],
                    practice_simulation=row['practice_simulation'],
                    can_edit=row['can_edit'],
                    can_delete=row['can_delete'],
                    can_duplicate=row['can_duplicate'],
                    num_scenarios=row['num_scenarios'],
                    scenario_ids=scenario_ids,
                    rubric_id=str(row['rubric_id']),
                )
            )

        # Get scenario mapping with enhanced data
        if scenario_ids_to_fetch := list(
            set([sid for s in simulations for sid in s.scenario_ids])
        ):
            # Create scenario service locally to avoid storing service dependencies
            from app.services.scenario_service import ScenarioService
            scenario_service = ScenarioService(self.conn)
            scenario_mapping = await scenario_service.build_enhanced_scenario_mapping(
                scenario_ids_to_fetch
            )

        # Get rubric names for mapping
        if rubric_ids_to_fetch := list(
            set([s.rubric_id for s in simulations if s.rubric_id])
        ):
            query, params = self.queries.get_rubric_mapping(rubric_ids_to_fetch)
            rubric_result = await self.conn.fetch(query, *params)

            for row in rubric_result:
                rubric_mapping[str(row['id'])] = RubricMappingItem(
                    name=row['name'],
                    description=row['description']
                )

        return SimulationsListResponse(
            simulations=simulations,
            scenario_mapping=scenario_mapping,
            rubric_mapping=rubric_mapping,
        )

    @with_cache(lambda self, request: keys.simulation_by_id(request.simulationId, request.profileId))
    async def get_simulation_detail(
        self, request: SimulationDetailRequest
    ) -> SimulationDetailResponse:
        """Get detailed simulation information using dynamic SQL."""
        return await self._execute_get_simulation_detail(request)

    async def _execute_get_simulation_detail(
        self, request: SimulationDetailRequest
    ) -> SimulationDetailResponse:
        """Execute simulation detail query (extracted for caching)."""
        # Get simulation basic info
        query, params = self.queries.get_simulation_by_id(request.simulationId)
        simulation = await self.conn.fetchrow(query, *params)

        if not simulation:
            raise ValueError(f"Simulation not found: {request.simulationId}")

        # Get user profile for permission checks
        query, params = self.queries.get_profile_role(request.profileId)
        profile_row = await self.conn.fetchrow(query, *params)
        user_role = profile_row['role'] if profile_row else 'trainee'

        # Check if simulation is in use (linked to cohorts)
        query, params = self.queries.get_cohort_usage_for_simulation(request.simulationId)
        cohort_usage = await self.conn.fetchrow(query, *params)
        cohort_count = cohort_usage['cohort_count'] if cohort_usage else 0
        in_use = cohort_count > 0

        # Compute permissions
        is_admin = user_role in ('admin', 'superadmin')
        can_edit = is_admin and (not simulation.default_simulation or user_role == 'superadmin')
        can_duplicate = is_admin
        can_delete = is_admin and not in_use

        # Get scenario IDs with positions from junction table
        query, params = self.queries.get_simulation_scenarios(request.simulationId)
        scenario_result = await self.conn.fetch(query, *params)
        scenario_ids = [str(row['scenario_id']) for row in scenario_result]

        # Get full scenario data with positions
        scenarios_list: List[ScenarioInSimulation] = []
        if scenario_ids:
            # Get scenarios with their data
            query, params = self.queries.get_scenarios_with_positions(
                request.simulationId, scenario_ids
            )
            scenarios_data = await self.conn.fetch(query, *params)

            # Get parameter items for each scenario
            for scenario_data in scenarios_data:
                # Get parameter item IDs for this scenario
                query, params = self.queries.get_scenario_parameter_items(str(scenario_data['id']))
                param_items = await self.conn.fetch(query, *params)
                param_item_ids = [str(row['parameter_item_id']) for row in param_items]

                scenarios_list.append(
                    ScenarioInSimulation(
                        scenario_id=str(scenario_data['id']),
                        title=scenario_data['name'],
                        description=scenario_data['problem_statement'] or '',
                        active=scenario_data['active'],
                        default_scenario=scenario_data['default_scenario'] or False,
                        position=scenario_data['position'],
                        parameter_item_ids=param_item_ids
                    )
                )

        # Get user's accessible department IDs
        query, params = self.queries.get_valid_departments_for_profile(
            request.profileId
        )
        dept_result = await self.conn.fetch(query, *params)
        valid_department_ids = [str(row['id']) for row in dept_result]

        # Get valid scenarios
        query, params = self.queries.get_valid_scenarios(valid_department_ids)
        valid_scenario_ids = [
            str(row['id']) for row in await self.conn.fetch(query, *params)
        ]

        # Get valid rubrics with mapping
        query, params = self.queries.get_valid_rubrics(valid_department_ids)
        rubrics_result = await self.conn.fetch(query, *params)
        valid_rubric_ids = [str(row['id']) for row in rubrics_result]
        rubric_mapping = {
            str(row['id']): RubricMappingItem(name=row['name'], description=row['description'])
            for row in rubrics_result
        }

        # Get scenario mapping with enhanced data
        if scenario_ids:
            # Create scenario service locally to avoid storing service dependencies
            from app.services.scenario_service import ScenarioService
            scenario_service = ScenarioService(self.conn)
            scenario_mapping = await scenario_service.build_enhanced_scenario_mapping(scenario_ids)
        else:
            scenario_mapping = {}

        # Get department mapping
        department_mapping = {
            str(row['id']): DepartmentMappingItem(
                name=row['name'], description=row['description'] or ''
            )
            for row in dept_result
        }

        # Get parameters for valid departments
        query, params = self.queries.get_parameters_for_departments(valid_department_ids)
        params_result = await self.conn.fetch(query, *params)
        
        parameters_list = []
        parameter_mapping: ParameterMapping = {}
        for row in params_result:
            parameter_mapping[str(row['id'])] = ParameterMappingItem(
                name=row['name'],
                description=row['description']
            )

        # Get parameter items for valid departments
        query, params = self.queries.get_parameter_items_for_departments(valid_department_ids)
        param_items_result = await self.conn.fetch(query, *params)
        
        parameter_items_list = []
        parameter_item_mapping: ParameterItemMapping = {}
        for row in param_items_result:
            parameter_items_list.append(
                ParameterItemDetail(
                    id=str(row['id']),
                    name=row['name'],
                    description=row['description'] if row['description'] else None,
                    parameter_id=str(row['parameter_id'])
                )
            )
            parameters_list.append(
                ParameterItem(
                    id=str(row['id']),
                    parameter_id=str(row['parameter_id']),
                    name=row['name'],
                    description=row['description'] if row['description'] else None
                )
            )
            # Get parameter name for the mapping
            param_name = next(
                (p['name'] for p in params_result if str(p['id']) == str(row['parameter_id'])),
                "Unknown"
            )
            parameter_item_mapping[str(row['id'])] = ParameterItemMappingItem(
                name=row['name'],
                description=row['description'],
                parameter_id=str(row['parameter_id']),
                parameter_name=param_name
            )

        return SimulationDetailResponse(
            # Basic fields
            name=simulation['title'],
            description=simulation['description'],
            department_id=str(simulation['department_id']),
            valid_department_ids=valid_department_ids,
            time_limit=simulation['time_limit'],
            rubric_id=str(simulation['rubric_id']),
            valid_rubric_ids=valid_rubric_ids,
            scenario_ids=scenario_ids,
            valid_scenario_ids=valid_scenario_ids,
            # Boolean parameters
            active=simulation['active'],
            default_simulation=simulation['default_simulation'],
            practice_simulation=simulation['practice_simulation'],
            hints_enabled=simulation['hints_enabled'],
            input_guardrail_active=simulation['input_guardrail_active'],
            output_guardrail_active=simulation['output_guardrail_active'],
            image_input_active=simulation['image_input_active'],
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

        # Get default simulation for profile
        query, params = self.queries.get_default_simulation(request.profileId)
        simulation = await self.conn.fetchrow(query, *params)

        if not simulation:
            raise ValueError("No simulations found for user's departments")

        # Reuse the detail logic with the found simulation_id
        detail_request = SimulationDetailRequest(
            simulationId=str(simulation['id']), profileId=request.profileId
        )

        return await self.get_simulation_detail(detail_request)

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

            simulation_id = str(result['id'])
            
            # Insert time limit if provided (into junction table)
            if request.time_limit is not None:
                time_limit_query = self.queries.insert_simulation_time_limit()
                await self.conn.execute(time_limit_query, simulation_id, request.time_limit)

            # Insert scenario relationships
            insert_query = self.queries.insert_simulation_scenario()
            for scenario_id in request.scenario_ids:
                await self.conn.execute(
                    insert_query,
                    simulation_id,
                    scenario_id,
                )

            # Invalidate affected caches
            await self._invalidate_cache([
                    keys.tag_simulation_all(),
                    keys.tag_analytics_all(),
                ])

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
            delete_query, delete_params = self.queries.delete_simulation_time_limit(request.simulationId)
            await self.conn.execute(delete_query, *delete_params)
            
            if request.time_limit is not None:
                insert_query = self.queries.insert_simulation_time_limit()
                await self.conn.execute(insert_query, request.simulationId, request.time_limit)

            # Delete existing scenarios
            query, params = self.queries.delete_simulation_scenarios(request.simulationId)
            await self.conn.execute(query, *params)

            # Insert new scenario relationships
            insert_query = self.queries.insert_simulation_scenario()
            for scenario_id in request.scenario_ids:
                await self.conn.execute(
                    insert_query,
                    request.simulationId,
                    scenario_id,
                )

            # Invalidate affected caches
            await self._invalidate_cache([
                    keys.tag_simulation_by_id(request.simulationId),
                    keys.tag_simulation_all(),
                    keys.tag_analytics_all(),
                ])

            return UpdateSimulationResponse(
                success=True, message=f"Simulation '{request.title}' updated successfully"
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
                result['title'],
                result['description'],
                result['department_id'],
                result['hints_enabled'],
                result['input_guardrail_active'],
                result['output_guardrail_active'],
                result['image_input_active'],
                result['rubric_id'],
            )

            if not new_simulation:
                raise ValueError("Failed to create duplicate simulation")
            
            new_simulation_id = str(new_simulation['id'])
            
            # Copy time limit if original has one
            get_limit_query, get_limit_params = self.queries.get_simulation_time_limit(request.simulationId)
            time_limit_result = await self.conn.fetchrow(get_limit_query, *get_limit_params)
            
            if time_limit_result:
                insert_limit_query = self.queries.insert_simulation_time_limit()
                await self.conn.execute(
                    insert_limit_query,
                    new_simulation_id,
                    time_limit_result['time_limit_seconds']
                )

            # Copy simulation_scenarios relationships
            copy_query = self.queries.copy_simulation_scenarios()
            await self.conn.execute(
                copy_query,
                new_simulation['id'],
                request.simulationId,
            )

            # Invalidate affected caches
            await self._invalidate_cache([
                    keys.tag_simulation_all(),
                    keys.tag_analytics_all(),
                ])

            return DuplicateSimulationResponse(
                success=True,
                simulationId=str(new_simulation['id']),
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

            if usage['usage_count'] > 0:
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
            await self._invalidate_cache([
                    keys.tag_simulation_by_id(request.simulationId),
                    keys.tag_simulation_all(),
                    keys.tag_analytics_all(),
                ])

            return DeleteSimulationResponse(
                success=True, message=f"Simulation '{simulation['title']}' deleted successfully"
            )

    # ===== WebSocket Simulation Attempt Operations =====

    async def start_simulation_attempt(
        self,
        simulation_id: str,
        profile_id: str | None,
        scenario_id_override: str | None,
        infinite: bool,
        department_id: str,
    ) -> Dict[str, Any]:
        """Create simulation attempt with all related entities.
        
        Returns:
            {
                "attempt_id": UUID,
                "chat_id": UUID,
                "chat_title": str,
                "scenario": Dict
            }
        """
        import random
        from datetime import datetime, timezone

        from agents import gen_trace_id
        from app.agents.collection.scenario import run_scenario_agent

        # Get the simulation
        query, params = self.queries.get_simulation_by_id(simulation_id)
        simulation = await self.conn.fetchrow(query, *params)
        if not simulation:
            raise ValueError(f"Simulation {simulation_id} not found")

        # Create the attempt
        query = self.queries.create_attempt()
        new_attempt = await self.conn.fetchrow(
            query,
            simulation_id,
            infinite
        )
        attempt_id = new_attempt['id']

        # Create attempt_profiles junction record if profile exists
        if profile_id:
            query = self.queries.create_attempt_profile()
            await self.conn.execute(query, attempt_id, profile_id, True)

        # Load scenarios for this simulation from junction table
        query, params = self.queries.get_simulation_scenarios_ordered(simulation_id)
        scenario_links = await self.conn.fetch(query, *params)

        # Determine which scenario to use
        if scenario_id_override:
            query, params = self.queries.get_scenario_by_id(scenario_id_override)
            old_scenario = await self.conn.fetchrow(query, *params)
            if not old_scenario:
                raise ValueError(f"Scenario {scenario_id_override} not found")
            chosen_scenario_id = old_scenario['id']
        elif not scenario_links:
            # No scenarios configured, select random scenario
            query, params = self.queries.get_all_scenarios_minimal()
            all_scenarios = await self.conn.fetch(query, *params)
            if not all_scenarios:
                raise ValueError("No scenarios available in the system")
            random_scenario = random.choice(all_scenarios)
            chosen_scenario_id = random_scenario['id']
        else:
            chosen_scenario_id = scenario_links[0]['scenario_id']

        query, params = self.queries.get_scenario_by_id(str(chosen_scenario_id))
        old_scenario = await self.conn.fetchrow(query, *params)
        if not old_scenario:
            raise ValueError(f"Scenario {chosen_scenario_id} not found")

        # Randomly fill any null attributes in the scenario
        import uuid as uuid_module

        # Create scenario service locally to avoid storing service dependencies
        from app.services.scenario_service import ScenarioService
        scenario_service = ScenarioService(self.conn)
        scenario = await scenario_service.randomly_fill_scenario_attributes(
            dict(old_scenario), uuid_module.UUID(department_id)
        )

        # Generate scenario problem_statement if empty
        if not scenario.get('problem_statement') or scenario.get('problem_statement') == "":
            # Use optimized query to get all scenario metadata in one query
            query, params = self.queries.get_scenario_full_metadata(str(scenario['id']))
            scenario_metadata = await self.conn.fetchrow(query, *params)
            
            doc_ids = list(scenario_metadata['document_ids']) if scenario_metadata['document_ids'] else []
            param_ids = list(scenario_metadata['parameter_item_ids']) if scenario_metadata['parameter_item_ids'] else []
            scenario_persona_id = scenario_metadata['persona_id']

            # Get profile from attempt with optimized query
            query, params = self.queries.get_attempt_with_profile(str(attempt_id))
            attempt_with_profile = await self.conn.fetchrow(query, *params)
            attempt_profile_id = attempt_with_profile['profile_id'] if attempt_with_profile else None

            name, description, objectives, trace_id = await run_scenario_agent(
                department_id=uuid_module.UUID(department_id),
                persona_id=scenario_persona_id,
                document_ids=doc_ids,
                parameter_item_ids=param_ids,
                group_id=uuid_module.UUID(str(attempt_id)),
                conn=self.conn,
                profile_id=attempt_profile_id,
            )
            scenario['name'] = name
            scenario['problem_statement'] = description
            chat_title = scenario['name']
        else:
            chat_title = scenario['name']
            trace_id = gen_trace_id()

        # Create the chat
        query = self.queries.create_simulation_chat()
        chat = await self.conn.fetchrow(
            query,
            datetime.now(timezone.utc),
            chat_title,
            scenario['id'],
            attempt_id,
            False,
            trace_id
        )

        return {
            "attempt_id": attempt_id,
            "chat_id": chat['id'],
            "chat_title": chat_title,
            "scenario": scenario
        }

    async def stop_simulation_run(self, chat_id: str) -> Dict[str, Any]:
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
            await self.conn.execute(query, assistant_msg['id'])

            return {
                "success": True,
                "cancelled_message_id": assistant_msg['id'],
                "final_content": assistant_msg['content'] or "",
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
    ) -> Dict[str, Any]:
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
        query, params = self.queries.get_simulation_by_id(str(simulation_attempt['simulation_id']))
        simulation = await self.conn.fetchrow(query, *params)
        if not simulation:
            raise ValueError("Simulation not found")

        # Load scenarios for this simulation from junction table
        query, params = self.queries.get_simulation_scenarios_ordered(str(simulation['id']))
        scenario_links = await self.conn.fetch(query, *params)
        is_infinite_mode = bool(simulation_attempt['infinite_mode'])

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
                    next_scenario_id = scenario_links[cycling_index]['scenario_id']
            elif next_index < len(scenario_links):
                next_scenario_id = scenario_links[next_index]['scenario_id']

            if next_scenario_id is not None:
                created_next_chat = await self._create_chat_for_scenario(
                    str(next_scenario_id),
                    attempt_id,
                    department_id,
                    mark_completed=False
                )
                if created_next_chat is None:
                    raise ValueError("Next scenario not found")
                next_chat_id = created_next_chat['id']

        # Grade the just-completed chat if it has at least 2 messages
        # Use optimized batch query to get message counts
        existing_chat_ids = [str(c['id']) for c in existing_chats]
        query, params = self.queries.get_messages_count_by_chat_ids(existing_chat_ids)
        message_counts = await self.conn.fetch(query, *params)
        message_count_map = {str(row['chat_id']): row['message_count'] for row in message_counts}
        
        simulation_grade_id = None
        chat_message_count = message_count_map.get(chat_id, 0)
        if chat_message_count >= 2:
            simulation_grade_id = await run_grade_agent(chat_id, department_id, self.conn, sio_instance)  # type: ignore

        # Mark the current chat as completed
        query, params = self.queries.update_chat_completed(chat_id)
        await self.conn.execute(query, *params)

        created_chats_count = 0
        if end_all:
            # End any other incomplete chats for this attempt
            for existing_chat in existing_chats:
                if not existing_chat['completed'] and existing_chat['id'] != chat_id:
                    other_message_count = message_count_map.get(str(existing_chat['id']), 0)
                    if other_message_count >= 2:
                        await run_grade_agent(existing_chat['id'], department_id, self.conn, sio_instance)  # type: ignore
                    query, params = self.queries.update_chat_completed(str(existing_chat['id']))
                    await self.conn.execute(query, *params)

            # Calculate and create remaining chats in order
            start_index = len(existing_chats)
            total_needed = max(0, len(scenario_links) - start_index)

            for offset in range(total_needed):
                next_id = scenario_links[start_index + offset]['scenario_id']
                created = await self._create_chat_for_scenario(
                    str(next_id),
                    attempt_id,
                    department_id,
                    mark_completed=True
                )
                if created is None:
                    break
                created_chats_count += 1

        is_attempt_finished = next_chat_id == chat_id

        # Invalidate analytics caches (grades affect analytics)
        await self._invalidate_cache([
                keys.tag_analytics_all(),
            ])

        return {
            "completed_chat_id": chat_id,
            "next_chat_id": next_chat_id,
            "is_attempt_finished": is_attempt_finished,
            "simulation_grade_id": simulation_grade_id,
            "created_chats_count": created_chats_count,
        }

    # ===== Message Operations =====

    async def create_user_message(self, chat_id: str, content: str) -> Dict[str, Any]:
        """Create user message in chat.
        
        Returns: {"id": UUID, "created_at": datetime}
        """
        query = self.queries.create_message()
        result = await self.conn.fetchrow(query, chat_id, "query", content, True)
        return {"id": result['id'], "created_at": result['created_at']}

    async def create_assistant_message_placeholder(self, chat_id: str) -> Dict[str, Any]:
        """Create empty assistant message for streaming.
        
        Returns: {"id": UUID, "created_at": datetime}
        """
        query = self.queries.create_message()
        result = await self.conn.fetchrow(query, chat_id, "response", "", False)
        return {"id": result['id'], "created_at": result['created_at']}

    async def update_message_content(self, message_id: str, content: str) -> None:
        """Update message content during streaming."""
        query = self.queries.update_message_content()
        await self.conn.execute(query, content, message_id)

    async def complete_message(self, message_id: str, final_content: str | None = None) -> None:
        """Mark message as completed, optionally updating content."""
        if final_content is not None:
            query = self.queries.update_message_content_and_completed()
            await self.conn.execute(query, final_content, message_id)
        else:
            query = self.queries.update_message_completed()
            await self.conn.execute(query, message_id)

    @with_cache(lambda self, chat_id: keys.simulation_for_chat(chat_id), fresh_ttl=10, stale_ttl=60)
    async def get_simulation_for_chat(self, chat_id: str) -> Dict[str, Any]:
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
            "simulation_id": result['simulation_id'],
            "attempt_id": result['attempt_id'],
            "practice_simulation": result['practice_simulation'],
        }

    # ===== Private Helper Methods =====

    async def _create_chat_for_scenario(
        self,
        scenario_id: str,
        attempt_id: str,
        department_id: str,
        mark_completed: bool,
    ) -> Dict[str, Any] | None:
        """Create chat for a scenario with full scenario preparation.
        
        This is a private helper used by continue_simulation_attempt.
        """
        from datetime import datetime, timezone

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
        if not scenario.get('problem_statement') or scenario.get('problem_statement') == "":
            # Use optimized query to get all scenario metadata in one query
            query, params = self.queries.get_scenario_full_metadata(str(scenario['id']))
            scenario_metadata = await self.conn.fetchrow(query, *params)
            
            doc_ids = list(scenario_metadata['document_ids']) if scenario_metadata['document_ids'] else []
            param_ids = list(scenario_metadata['parameter_item_ids']) if scenario_metadata['parameter_item_ids'] else []
            scenario_persona_id = scenario_metadata['persona_id']

            # Get profile from attempt with optimized query
            query, params = self.queries.get_attempt_with_profile(attempt_id)
            attempt_with_profile = await self.conn.fetchrow(query, *params)
            attempt_profile_id = attempt_with_profile['profile_id'] if attempt_with_profile else None

            name, description, objectives, trace_id = await run_scenario_agent(
                department_id=scenario['department_id'],
                persona_id=scenario_persona_id,
                document_ids=doc_ids,
                parameter_item_ids=param_ids,
                group_id=uuid_module.UUID(attempt_id) if attempt_id else None,
                conn=self.conn,
                profile_id=attempt_profile_id,
            )
            scenario['name'] = name
            scenario['problem_statement'] = description
            chat_title = scenario['name']
        else:
            chat_title = scenario['name']
            trace_id = gen_trace_id()

        # Create chat
        query = self.queries.create_simulation_chat()
        chat = await self.conn.fetchrow(
            query,
            datetime.now(timezone.utc),
            chat_title,
            scenario['id'],
            attempt_id,
            mark_completed,
            trace_id
        )

        return dict(chat) if chat else None

    # ===== Analytics Methods for MCP Tools =====

    async def get_simulation_attempts(
        self, sim_id: str, limit: int = 200
    ) -> List[Dict[str, Any]]:
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
            simulation_uuid = __import__('uuid').UUID(sim_id)
        except ValueError:
            return [{"error": f"Invalid sim_id format: {sim_id}"}]
        
        return await self._get_simulation_attempts_cached(str(simulation_uuid), limit)

    @with_cache(lambda self, sim_id, limit: keys.simulation_attempts_list(sim_id, limit))
    async def _get_simulation_attempts_cached(
        self, sim_id: str, limit: int
    ) -> List[Dict[str, Any]]:
        """Get simulation attempts with caching."""
        return await self._execute_get_simulation_attempts(sim_id, limit)

    async def _execute_get_simulation_attempts(
        self, sim_id: str, limit: int
    ) -> List[Dict[str, Any]]:
        """Execute simulation attempts query (extracted for caching)."""
        try:
            # Verify simulation exists
            query, params = self.queries.get_simulation_by_id(sim_id)
            simulation = await self.conn.fetchrow(query, *params)
            if not simulation:
                return [{"error": f"Simulation not found: {sim_id}"}]

            # Get all attempts for this simulation with student info and grades
            query, params = self.queries.get_simulation_attempts_list(
                sim_id, limit
            )
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

                results.append({
                    "id": str(attempt["id"]),
                    "student": student_name,
                    "student_id": str(attempt["profile_id"]) if attempt["profile_id"] else None,
                    "score": attempt["score"],
                    "passed": attempt["passed"],
                    "time_taken": attempt["time_taken"],
                    "created_at": attempt["created_at"].isoformat() if attempt["created_at"] else None,
                })

            return results

        except Exception as e:
            return [{"error": f"Database error: {str(e)}"}]

    # ===== Overview Methods for MCP Tools =====

    async def get_simulation_overview(self, sim_id: str) -> Dict[str, Any]:
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
    async def _get_simulation_overview_cached(self, sim_id: str) -> Dict[str, Any]:
        """Get simulation overview with caching."""
        return await self._execute_get_simulation_overview(sim_id)

    async def _execute_get_simulation_overview(self, sim_id: str) -> Dict[str, Any]:
        """Execute simulation overview query (extracted for caching)."""
        import uuid
        
        try:
            query, params = self.queries.get_simulation_overview_complete(uuid.UUID(sim_id))
            result = await self.conn.fetchrow(query, *params)
            
            if not result:
                return {"error": f"Simulation not found: {sim_id}"}

            # Transform JSON-aggregated data into response dict
            simulation_data = {
                "id": str(result["id"]),
                "title": result["title"],
                "active": result["active"],
                "time_limit": result["time_limit"],
                "created_at": result["created_at"].isoformat() if result["created_at"] else None,
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
                cohorts_data.append({
                    "id": str(cohort["id"]),
                    "title": cohort["title"],
                    "active": cohort["active"],
                })

            # Transform scenarios (jsonb array to list of dicts)
            scenarios_data = []
            for scenario in result["scenarios"]:
                scenarios_data.append({
                    "id": str(scenario["id"]),
                    "name": scenario["name"],
                    "problem_statement": scenario["problem_statement"],
                    "position": scenario["position"],
                })

            # Calculate pass rate
            pass_rate = 0.0
            if result["total_graded"] and result["total_graded"] > 0:
                pass_rate = round((result["total_passed"] / result["total_graded"]) * 100, 2)

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
    ) -> List[Dict[str, Any]]:
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
    ) -> List[Dict[str, Any]]:
        """Search simulations with caching."""
        return await self._execute_search_simulations(query, limit)

    async def _execute_search_simulations(
        self, query: str, limit: int
    ) -> List[Dict[str, Any]]:
        """Execute simulation search query (extracted for caching)."""
        q_norm = normalize_text(query)
        if not q_norm:
            return []

        toks = tokenize(query)

        # Build fuzzy search conditions
        where_clause, params, param_idx = build_fuzzy_conditions(["s.title"], query)

        # Build and execute query
        query_template, _ = self.queries.search_simulations_fuzzy(where_clause, limit * 5)
        sql = query_template.replace("{param_count}", str(param_idx))
        params.append(limit * 5)  # Candidate pool

        sims = await self.conn.fetch(sql, *params)

        # Score and build results
        results = []
        for sim in sims:
            score = self._score_simulation(q_norm, toks, sim["title"])
            results.append({
                "id": str(sim["id"]),
                "title": sim["title"],
                "active": sim["active"],
                "time_limit": sim["time_limit"],
                "created_at": sim["created_at"].isoformat() if sim["created_at"] else None,
                "score": score,
            })

        results.sort(key=lambda r: (-r["score"], r["title"]))
        return results[:limit]

    def _score_simulation(
        self, q_norm: str, toks: List[str], title: str | None
    ) -> int:
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
