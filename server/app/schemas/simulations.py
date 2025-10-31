"""Simulations V2 API schemas."""

from pydantic import BaseModel

from .base import (DepartmentMapping, ParameterItemMapping, ParameterMapping,
                   RubricMapping, ScenarioMapping)

# ============================================================================
# REQUEST SCHEMAS
# ============================================================================


class SimulationsFilters(BaseModel):
    """Filters for simulations list."""

    profileId: str


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================


class SimulationItem(BaseModel):
    """Simulation item in list response."""

    simulation_id: str
    name: str  # Maps to simulations.title
    description: str
    department_ids: list[str] | None  # None = cross-department (all departments)
    time_limit: int | None
    active: bool
    practice_simulation: bool
    can_edit: bool
    can_delete: bool
    can_duplicate: bool
    scenario_ids: list[str]
    rubric_id: str
    num_cohorts: int  # Number of cohorts using this simulation


class SimulationsListResponse(BaseModel):
    """Response for simulations list endpoint."""

    simulations: list[SimulationItem]
    scenario_mapping: ScenarioMapping
    rubric_mapping: RubricMapping
    department_mapping: DepartmentMapping


# ============================================================================
# DETAIL SCHEMAS
# ============================================================================


class ScenarioInSimulation(BaseModel):
    """Scenario with position in simulation."""

    scenario_id: str
    title: str
    description: str
    active: bool
    position: int  # From simulation_scenarios junction table
    parameter_item_ids: list[str]  # For displaying badges

    # Statistics fields
    usage_count: int  # Number of all chats (regardless of completion)
    success_rate: int  # Percentage (0-100) of completed chats that passed
    last_used: str | None  # ISO timestamp or None
    can_remove: bool  # True if usage_count == 0


class ParameterItem(BaseModel):
    """Parameter data for dropdown."""

    id: str
    parameter_id: str
    name: str
    description: str | None


class ParameterItemDetail(BaseModel):
    """Full parameter item details."""

    id: str
    name: str
    description: str | None
    parameter_id: str


class SimulationDetailRequest(BaseModel):
    """Request for simulation detail."""

    simulationId: str
    profileId: str


class SimulationDetailResponse(BaseModel):
    """Response for simulation detail endpoint."""

    # Basic fields
    name: str  # Maps to simulations.title
    description: str
    department_ids: list[str] | None  # None = cross-department (all departments)
    valid_department_ids: list[str]
    time_limit: int | None
    rubric_id: str
    valid_rubric_ids: list[str]
    scenario_ids: list[str]
    valid_scenario_ids: list[str]

    # Boolean parameters
    active: bool
    practice_simulation: bool

    # Permission flags
    can_edit: bool
    can_duplicate: bool
    can_delete: bool

    # Usage status
    in_use: bool
    cohort_count: int

    # Full scenario objects (ordered by position)
    scenarios: list[ScenarioInSimulation]

    # Parameter data for scenario picker
    parameters: list[ParameterItem]
    parameter_items: list[ParameterItemDetail]
    parameter_mapping: ParameterMapping

    # Top-level mappings
    scenario_mapping: ScenarioMapping
    rubric_mapping: RubricMapping
    department_mapping: DepartmentMapping
    parameter_item_mapping: ParameterItemMapping


class SimulationDetailDefaultRequest(BaseModel):
    """Request for default simulation detail."""

    profileId: str


# ============================================================================
# MUTATION SCHEMAS
# ============================================================================


class ScenarioInRequest(BaseModel):
    """Scenario with active state for create/update requests."""

    scenario_id: str
    active: bool = True


class CreateSimulationRequest(BaseModel):
    """Request to create simulation."""

    title: str
    description: str
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    active: bool
    practice_simulation: bool
    time_limit: int | None
    rubric_id: str
    scenario_ids: (
        list[str] | list[ScenarioInRequest]
    )  # Support both formats for backward compatibility


class CreateSimulationResponse(BaseModel):
    """Response from create simulation."""

    success: bool
    simulationId: str
    message: str


class UpdateSimulationRequest(BaseModel):
    """Request to update simulation."""

    simulationId: str
    title: str
    description: str
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    active: bool
    practice_simulation: bool
    time_limit: int | None
    rubric_id: str
    scenario_ids: (
        list[str] | list[ScenarioInRequest]
    )  # Support both formats for backward compatibility


class UpdateSimulationResponse(BaseModel):
    """Response from update simulation."""

    success: bool
    message: str


class DuplicateSimulationRequest(BaseModel):
    """Request to duplicate simulation."""

    simulationId: str


class DuplicateSimulationResponse(BaseModel):
    """Response from duplicate simulation."""

    success: bool
    simulationId: str
    message: str


class DeleteSimulationRequest(BaseModel):
    """Request to delete simulation."""

    simulationId: str


class DeleteSimulationResponse(BaseModel):
    """Response from delete simulation."""

    success: bool
    message: str
