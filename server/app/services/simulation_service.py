"""Simulation service layer - business logic for simulation operations."""

from typing import Any, Dict, List

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
from app.services.scenario_service import ScenarioService
import asyncpg  # type: ignore
from app.db import transaction


class SimulationService:
    """Service layer for simulation operations."""

    def __init__(self, conn: asyncpg.Connection):
        """Initialize service with database session."""
        self.conn = conn
        self.queries = SimulationQueries()
        self.scenario_service = ScenarioService(conn)

    async def get_simulations_list(
        self, filters: SimulationsFilters
    ) -> SimulationsListResponse:
        """Get simulations list with permissions using dynamic SQL."""

        # Get query from query builder
        query, params = self.queries.list_simulations(
            filters.departmentIds, filters.profileId
        )

        result = await self.conn.fetch(query, *params)

        # Build response
        simulations = []
        scenario_mapping = {}
        rubric_mapping: RubricMapping = {}

        for row in result:
            # Convert UUID arrays to string arrays
            scenario_ids = [str(sid) for sid in (row.scenario_ids or [])]

            simulations.append(
                SimulationItem(
                    simulation_id=str(row['simulation_id']),
                    name=row['name'],
                    description=row.description,
                    time_limit=row.time_limit,
                    active=row.active,
                    default_simulation=row.default_simulation,
                    practice_simulation=row.practice_simulation,
                    can_edit=row.can_edit,
                    can_delete=row.can_delete,
                    can_duplicate=row.can_duplicate,
                    num_scenarios=row.num_scenarios,
                    scenario_ids=scenario_ids,
                    rubric_id=str(row.rubric_id),
                )
            )

        # Get scenario mapping with enhanced data
        if scenario_ids_to_fetch := list(
            set([sid for s in simulations for sid in s.scenario_ids])
        ):
            scenario_mapping = await self.scenario_service.build_enhanced_scenario_mapping(
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
                    description=row.description
                )

        return SimulationsListResponse(
            simulations=simulations,
            scenario_mapping=scenario_mapping,
            rubric_mapping=rubric_mapping,
        )

    async def get_simulation_detail(
        self, request: SimulationDetailRequest
    ) -> SimulationDetailResponse:
        """Get detailed simulation information using dynamic SQL."""

        # Get simulation basic info
        query, params = self.queries.get_simulation_by_id(request.simulationId)
        simulation = await self.conn.fetchrow(query, *params)

        if not simulation:
            raise ValueError(f"Simulation not found: {request.simulationId}")

        # Get user profile for permission checks
        query = "SELECT role FROM profiles WHERE id = :profile_id"
        profile = await self.conn.execute(query, {"profile_id": request.profileId}).fetchone()
        user_role = profile.role if profile else 'trainee'

        # Check if simulation is in use (linked to cohorts)
        query = """
        SELECT COUNT(*) as cohort_count
        FROM cohort_simulations
        WHERE simulation_id = :simulation_id
        """
        cohort_usage = self.db.execute(
            text(query), {"simulation_id": request.simulationId}
        ).fetchone()
        cohort_count = cohort_usage.cohort_count if cohort_usage else 0
        in_use = cohort_count > 0

        # Compute permissions
        is_admin = user_role in ('admin', 'superadmin')
        can_edit = is_admin and (not simulation.default_simulation or user_role == 'superadmin')
        can_duplicate = is_admin
        can_delete = is_admin and not in_use

        # Get scenario IDs with positions from junction table
        query, params = self.queries.get_simulation_scenarios(request.simulationId)
        scenario_result = await self.conn.fetch(query, *params)
        scenario_ids = [str(row.scenario_id) for row in scenario_result]

        # Get full scenario data with positions
        scenarios_list: List[ScenarioInSimulation] = []
        if scenario_ids:
            # Get scenarios with their data
            query = """
            SELECT 
                s.id,
                s.name,
                s.problem_statement,
                s.active,
                s.default_scenario,
                ss.position
            FROM scenarios s
            JOIN simulation_scenarios ss ON ss.scenario_id = s.id
            WHERE ss.simulation_id = :simulation_id AND s.id = ANY(:scenario_ids)
            ORDER BY ss.position
            """
            scenarios_data = self.db.execute(
                text(query),
                {"simulation_id": request.simulationId, "scenario_ids": scenario_ids}
            ).fetchall()

            # Get parameter items for each scenario
            for scenario_data in scenarios_data:
                # Get parameter item IDs for this scenario
                query = """
                SELECT parameter_item_id
                FROM scenario_parameter_items
                WHERE scenario_id = :scenario_id
                """
                param_items = self.db.execute(
                    text(query), {"scenario_id": str(scenario_data.id)}
                ).fetchall()
                param_item_ids = [str(row.parameter_item_id) for row in param_items]

                scenarios_list.append(
                    ScenarioInSimulation(
                        scenario_id=str(scenario_data.id),
                        title=scenario_data.name,
                        description=scenario_data.problem_statement or '',
                        active=scenario_data.active,
                        default_scenario=scenario_data.default_scenario or False,
                        position=scenario_data.position,
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
            str(row['id']): RubricMappingItem(name=row['name'], description=row.description)
            for row in rubrics_result
        }

        # Get scenario mapping with enhanced data
        scenario_mapping = await self.scenario_service.build_enhanced_scenario_mapping(scenario_ids) if scenario_ids else {}

        # Get department mapping
        department_mapping = {
            str(row['id']): DepartmentMappingItem(
                name=row['name'], description=row.description or ''
            )
            for row in dept_result
        }

        # Get parameters for valid departments
        query = """
        SELECT id, name, COALESCE(description, '') as description
        FROM parameters
        WHERE department_id = ANY(:department_ids)
        ORDER BY name
        """
        params_result = self.db.execute(
            text(query), {"department_ids": valid_department_ids}
        ).fetchall()
        
        parameters_list = []
        parameter_mapping: ParameterMapping = {}
        for row in params_result:
            parameter_mapping[str(row['id'])] = ParameterMappingItem(
                name=row['name'],
                description=row.description
            )

        # Get parameter items for valid departments
        query = """
        SELECT pi.id, pi.parameter_id, pi.name, COALESCE(pi.description, '') as description
        FROM parameter_items pi
        JOIN parameters p ON p.id = pi.parameter_id
        WHERE p.department_id = ANY(:department_ids)
        ORDER BY p.name, pi.name
        """
        param_items_result = self.db.execute(
            text(query), {"department_ids": valid_department_ids}
        ).fetchall()
        
        parameter_items_list = []
        parameter_item_mapping: ParameterItemMapping = {}
        for row in param_items_result:
            parameter_items_list.append(
                ParameterItemDetail(
                    id=str(row['id']),
                    name=row['name'],
                    description=row.description if row.description else None,
                    parameter_id=str(row.parameter_id)
                )
            )
            parameters_list.append(
                ParameterItem(
                    id=str(row['id']),
                    parameter_id=str(row.parameter_id),
                    name=row['name'],
                    description=row.description if row.description else None
                )
            )
            # Get parameter name for the mapping
            param_name = next(
                (p.name for p in params_result if str(p.id) == str(row.parameter_id)),
                "Unknown"
            )
            parameter_item_mapping[str(row['id'])] = ParameterItemMappingItem(
                name=row['name'],
                description=row.description,
                parameter_id=str(row.parameter_id),
                parameter_name=param_name
            )

        return SimulationDetailResponse(
            # Basic fields
            name=simulation.title,
            description=simulation.description,
            department_id=str(simulation.department_id),
            valid_department_ids=valid_department_ids,
            time_limit=simulation.time_limit,
            rubric_id=str(simulation.rubric_id),
            valid_rubric_ids=valid_rubric_ids,
            scenario_ids=scenario_ids,
            valid_scenario_ids=valid_scenario_ids,
            # Boolean parameters
            active=simulation.active,
            default_simulation=simulation.default_simulation,
            practice_simulation=simulation.practice_simulation,
            hints_enabled=simulation.hints_enabled,
            input_guardrail_active=simulation.input_guardrail_active,
            output_guardrail_active=simulation.output_guardrail_active,
            image_input_active=simulation.image_input_active,
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
        """Create a new simulation using dynamic SQL."""

        query, _ = self.queries.create_simulation()
        result = self.db.execute(
            text(query),
            {
                "title": request.title,
                "description": request.description,
                "department_id": request.department_id,
                "active": request.active,
                "default_simulation": request.default_simulation,
                "practice_simulation": request.practice_simulation,
                "hints_enabled": request.hints_enabled,
                "input_guardrail_active": request.input_guardrail_active,
                "output_guardrail_active": request.output_guardrail_active,
                "image_input_active": request.image_input_active,
                "time_limit": request.time_limit,
                "rubric_id": request.rubric_id,
            },
        ).fetchone()

        if not result:
            raise ValueError("Failed to create simulation")

        simulation_id = str(result['id'])

        # Insert scenario relationships
        insert_query, _ = self.queries.insert_simulation_scenario()
        for scenario_id in request.scenario_ids:
            self.db.execute(
                text(insert_query),
                {"simulation_id": simulation_id, "scenario_id": scenario_id},
            )

        # Transaction handled

        return CreateSimulationResponse(
            success=True,
            simulationId=simulation_id,
            message=f"Simulation '{request.title}' created successfully",
        )

    async def update_simulation(
        self, request: UpdateSimulationRequest
    ) -> UpdateSimulationResponse:
        """Update an existing simulation using dynamic SQL."""

        # Check if simulation exists
        query, params = self.queries.get_simulation_name(request.simulationId)
        existing = await self.conn.fetchrow(query, *params)

        if not existing:
            raise ValueError(f"Simulation not found: {request.simulationId}")

        # Update simulation
        query, _ = self.queries.update_simulation()
        self.db.execute(
            text(query),
            {
                "simulation_id": request.simulationId,
                "title": request.title,
                "description": request.description,
                "department_id": request.department_id,
                "active": request.active,
                "default_simulation": request.default_simulation,
                "practice_simulation": request.practice_simulation,
                "hints_enabled": request.hints_enabled,
                "input_guardrail_active": request.input_guardrail_active,
                "output_guardrail_active": request.output_guardrail_active,
                "image_input_active": request.image_input_active,
                "time_limit": request.time_limit,
                "rubric_id": request.rubric_id,
            },
        )

        # Delete existing scenarios
        query, params = self.queries.delete_simulation_scenarios(request.simulationId)
        await self.conn.execute(query, params)

        # Insert new scenario relationships
        insert_query, _ = self.queries.insert_simulation_scenario()
        for scenario_id in request.scenario_ids:
            self.db.execute(
                text(insert_query),
                {"simulation_id": request.simulationId, "scenario_id": scenario_id},
            )

        # Transaction handled

        return UpdateSimulationResponse(
            success=True, message=f"Simulation '{request.title}' updated successfully"
        )

    def duplicate_simulation(
        self, request: DuplicateSimulationRequest
    ) -> DuplicateSimulationResponse:
        """Duplicate a simulation using dynamic SQL."""

        # Get original simulation data
        query, params = self.queries.get_simulation_for_duplicate(
            request.simulationId
        )
        result = await self.conn.fetchrow(query, *params)

        if not result:
            raise ValueError(f"Simulation not found: {request.simulationId}")

        # Insert duplicate
        duplicate_query, _ = self.queries.insert_duplicate_simulation()
        new_simulation = self.db.execute(
            text(duplicate_query),
            {
                "title": result.title,
                "description": result.description,
                "department_id": result.department_id,
                "hints_enabled": result.hints_enabled,
                "input_guardrail_active": result.input_guardrail_active,
                "output_guardrail_active": result.output_guardrail_active,
                "image_input_active": result.image_input_active,
                "time_limit": result.time_limit,
                "rubric_id": result.rubric_id,
            },
        ).fetchone()

        if not new_simulation:
            raise ValueError("Failed to create duplicate simulation")

        # Copy simulation_scenarios relationships
        copy_query, _ = self.queries.copy_simulation_scenarios()
        self.db.execute(
            text(copy_query),
            {
                "new_simulation_id": new_simulation['id'],
                "original_simulation_id": request.simulationId,
            },
        )

        # Transaction handled

        return DuplicateSimulationResponse(
            success=True,
            simulationId=str(new_simulation['id']),
            message=f"Simulation '{result.title}' duplicated successfully",
        )

    async def delete_simulation(
        self, request: DeleteSimulationRequest
    ) -> DeleteSimulationResponse:
        """Delete a simulation using dynamic SQL."""

        # Check if simulation is in use
        query, params = self.queries.check_simulation_usage(request.simulationId)
        usage = await self.conn.fetchrow(query, *params)

        if not usage:
            raise ValueError("Failed to check simulation usage")

        if usage.usage_count > 0:
            raise ValueError("Cannot delete simulation that has attempts")

        # Get simulation name
        query, params = self.queries.get_simulation_name(request.simulationId)
        simulation = await self.conn.fetchrow(query, *params)

        if not simulation:
            raise ValueError(f"Simulation not found: {request.simulationId}")

        # Delete simulation
        query, params = self.queries.delete_simulation(request.simulationId)
        await self.conn.execute(query, params)
        # Transaction handled

        return DeleteSimulationResponse(
            success=True, message=f"Simulation '{simulation.title}' deleted successfully"
        )

