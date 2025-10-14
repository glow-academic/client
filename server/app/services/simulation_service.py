"""Simulation service layer - business logic for simulation operations."""

from typing import Any, Dict, List

from app.queries.simulation_queries import SimulationQueries
from app.schemas.personas import DepartmentMappingItem
from app.schemas.simulations import (CreateSimulationRequest,
                                     CreateSimulationResponse,
                                     DeleteSimulationRequest,
                                     DeleteSimulationResponse,
                                     DuplicateSimulationRequest,
                                     DuplicateSimulationResponse,
                                     SimulationDetailDefaultRequest,
                                     SimulationDetailRequest,
                                     SimulationDetailResponse, SimulationItem,
                                     SimulationsFilters,
                                     SimulationsListResponse,
                                     UpdateSimulationRequest,
                                     UpdateSimulationResponse)
from sqlalchemy import text
from sqlalchemy.orm import Session


class SimulationService:
    """Service layer for simulation operations."""

    def __init__(self, db: Session):
        """Initialize service with database session."""
        self.db = db
        self.queries = SimulationQueries()

    def get_simulations_list(
        self, filters: SimulationsFilters
    ) -> SimulationsListResponse:
        """Get simulations list with permissions using dynamic SQL."""

        # Get query from query builder
        query, params = self.queries.list_simulations(
            filters.departmentIds, filters.profileId
        )

        result = self.db.execute(text(query), params).fetchall()

        # Build response
        simulations = []
        scenario_mapping = {}
        rubric_mapping = {}

        for row in result:
            # Convert UUID arrays to string arrays
            scenario_ids = [str(sid) for sid in (row.scenario_ids or [])]

            simulations.append(
                SimulationItem(
                    simulation_id=str(row.simulation_id),
                    name=row.name,
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

            # Collect rubric mapping
            if row.rubric_id:
                rubric_mapping[str(row.rubric_id)] = ""  # Will fetch names later

        # Get scenario names for mapping
        if scenario_ids_to_fetch := list(
            set([sid for s in simulations for sid in s.scenario_ids])
        ):
            query, params = self.queries.get_scenario_mapping(scenario_ids_to_fetch)
            scenario_result = self.db.execute(text(query), params).fetchall()

            for row in scenario_result:
                scenario_mapping[str(row.id)] = row.name

        # Get rubric names for mapping
        if rubric_ids_to_fetch := list(
            set([s.rubric_id for s in simulations if s.rubric_id])
        ):
            query, params = self.queries.get_rubric_mapping(rubric_ids_to_fetch)
            rubric_result = self.db.execute(text(query), params).fetchall()

            for row in rubric_result:
                rubric_mapping[str(row.id)] = row.name

        return SimulationsListResponse(
            simulations=simulations,
            scenario_mapping=scenario_mapping,
            rubric_mapping=rubric_mapping,
        )

    def get_simulation_detail(
        self, request: SimulationDetailRequest
    ) -> SimulationDetailResponse:
        """Get detailed simulation information using dynamic SQL."""

        # Get simulation basic info
        query, params = self.queries.get_simulation_by_id(request.simulationId)
        simulation = self.db.execute(text(query), params).fetchone()

        if not simulation:
            raise ValueError(f"Simulation not found: {request.simulationId}")

        # Get scenario IDs for this simulation
        query, params = self.queries.get_simulation_scenarios(request.simulationId)
        scenario_result = self.db.execute(text(query), params).fetchall()
        scenario_ids = [str(row.scenario_id) for row in scenario_result]

        # Get user's accessible department IDs
        query, params = self.queries.get_valid_departments_for_profile(
            request.profileId
        )
        dept_result = self.db.execute(text(query), params).fetchall()
        valid_department_ids = [str(row.id) for row in dept_result]

        # Get valid scenarios
        query, params = self.queries.get_valid_scenarios(valid_department_ids)
        valid_scenario_ids = [
            str(row.id) for row in self.db.execute(text(query), params).fetchall()
        ]

        # Get valid rubrics with mapping
        query, params = self.queries.get_valid_rubrics(valid_department_ids)
        rubrics_result = self.db.execute(text(query), params).fetchall()
        valid_rubric_ids = [str(row.id) for row in rubrics_result]
        rubric_mapping = {str(row.id): row.name for row in rubrics_result}

        # Get scenario mapping
        if scenario_ids:
            query, params = self.queries.get_scenario_mapping(scenario_ids)
            scenario_mapping_result = self.db.execute(text(query), params).fetchall()
            scenario_mapping = {
                str(row.id): row.name for row in scenario_mapping_result
            }
        else:
            scenario_mapping = {}

        # Get department mapping
        department_mapping = {
            str(row.id): DepartmentMappingItem(
                name=row.name, description=row.description
            )
            for row in dept_result
        }

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
            # Mappings
            scenario_mapping=scenario_mapping,
            rubric_mapping=rubric_mapping,
            department_mapping=department_mapping,
        )

    def get_simulation_detail_default(
        self, request: SimulationDetailDefaultRequest
    ) -> SimulationDetailResponse:
        """Get default simulation details based on profile."""

        # Get default simulation for profile
        query, params = self.queries.get_default_simulation(request.profileId)
        simulation = self.db.execute(text(query), params).fetchone()

        if not simulation:
            raise ValueError("No simulations found for user's departments")

        # Reuse the detail logic with the found simulation_id
        detail_request = SimulationDetailRequest(
            simulationId=str(simulation.id), profileId=request.profileId
        )

        return self.get_simulation_detail(detail_request)

    def create_simulation(
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

        simulation_id = str(result.id)

        # Insert scenario relationships
        insert_query, _ = self.queries.insert_simulation_scenario()
        for scenario_id in request.scenario_ids:
            self.db.execute(
                text(insert_query),
                {"simulation_id": simulation_id, "scenario_id": scenario_id},
            )

        self.db.commit()

        return CreateSimulationResponse(
            success=True,
            simulationId=simulation_id,
            message=f"Simulation '{request.title}' created successfully",
        )

    def update_simulation(
        self, request: UpdateSimulationRequest
    ) -> UpdateSimulationResponse:
        """Update an existing simulation using dynamic SQL."""

        # Check if simulation exists
        query, params = self.queries.get_simulation_name(request.simulationId)
        existing = self.db.execute(text(query), params).fetchone()

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
        self.db.execute(text(query), params)

        # Insert new scenario relationships
        insert_query, _ = self.queries.insert_simulation_scenario()
        for scenario_id in request.scenario_ids:
            self.db.execute(
                text(insert_query),
                {"simulation_id": request.simulationId, "scenario_id": scenario_id},
            )

        self.db.commit()

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
        result = self.db.execute(text(query), params).fetchone()

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
                "new_simulation_id": new_simulation.id,
                "original_simulation_id": request.simulationId,
            },
        )

        self.db.commit()

        return DuplicateSimulationResponse(
            success=True,
            simulationId=str(new_simulation.id),
            message=f"Simulation '{result.title}' duplicated successfully",
        )

    def delete_simulation(
        self, request: DeleteSimulationRequest
    ) -> DeleteSimulationResponse:
        """Delete a simulation using dynamic SQL."""

        # Check if simulation is in use
        query, params = self.queries.check_simulation_usage(request.simulationId)
        usage = self.db.execute(text(query), params).fetchone()

        if not usage:
            raise ValueError("Failed to check simulation usage")

        if usage.usage_count > 0:
            raise ValueError("Cannot delete simulation that has attempts")

        # Get simulation name
        query, params = self.queries.get_simulation_name(request.simulationId)
        simulation = self.db.execute(text(query), params).fetchone()

        if not simulation:
            raise ValueError(f"Simulation not found: {request.simulationId}")

        # Delete simulation
        query, params = self.queries.delete_simulation(request.simulationId)
        self.db.execute(text(query), params)
        self.db.commit()

        return DeleteSimulationResponse(
            success=True, message=f"Simulation '{simulation.title}' deleted successfully"
        )

