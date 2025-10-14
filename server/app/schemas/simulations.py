"""Simulations V2 API schemas."""

from typing import Dict, List, Optional

from pydantic import BaseModel

from .personas import DepartmentMappingItem

# ============================================================================
# CENTRALIZED MAPPING TYPES
# ============================================================================


class ScenarioMappingItem(BaseModel):
    """Scenario mapping item (id -> name)."""

    pass  # Just using Dict[str, str] for scenario_mapping


class RubricMappingItem(BaseModel):
    """Rubric mapping item (id -> name)."""

    pass  # Just using Dict[str, str] for rubric_mapping


# ============================================================================
# REQUEST SCHEMAS
# ============================================================================


class SimulationsFilters(BaseModel):
    """Filters for simulations list."""

    departmentIds: List[str]
    profileId: str


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================


class SimulationItem(BaseModel):
    """Simulation item in list response."""

    simulation_id: str
    name: str  # Maps to simulations.title
    description: str
    time_limit: Optional[int]
    active: bool
    default_simulation: bool
    practice_simulation: bool
    can_edit: bool
    can_delete: bool
    can_duplicate: bool
    num_scenarios: int
    scenario_ids: List[str]
    rubric_id: str


class SimulationsListResponse(BaseModel):
    """Response for simulations list endpoint."""

    simulations: List[SimulationItem]
    scenario_mapping: Dict[str, str]  # scenario_id -> name
    rubric_mapping: Dict[str, str]  # rubric_id -> name


# ============================================================================
# DETAIL SCHEMAS
# ============================================================================


class SimulationDetailRequest(BaseModel):
    """Request for simulation detail."""

    simulationId: str
    profileId: str


class SimulationDetailResponse(BaseModel):
    """Response for simulation detail endpoint."""

    # Basic fields
    name: str  # Maps to simulations.title
    description: str
    department_id: str
    valid_department_ids: List[str]
    time_limit: Optional[int]
    rubric_id: str
    valid_rubric_ids: List[str]
    scenario_ids: List[str]
    valid_scenario_ids: List[str]

    # Boolean parameters
    active: bool
    default_simulation: bool
    practice_simulation: bool
    hints_enabled: bool
    input_guardrail_active: bool
    output_guardrail_active: bool
    image_input_active: bool

    # Top-level mappings
    scenario_mapping: Dict[str, str]
    rubric_mapping: Dict[str, str]
    department_mapping: Dict[str, DepartmentMappingItem]


class SimulationDetailDefaultRequest(BaseModel):
    """Request for default simulation detail."""

    profileId: str


# ============================================================================
# MUTATION SCHEMAS
# ============================================================================


class CreateSimulationRequest(BaseModel):
    """Request to create simulation."""

    title: str
    description: str
    department_id: str
    active: bool
    default_simulation: bool
    practice_simulation: bool
    hints_enabled: bool
    input_guardrail_active: bool
    output_guardrail_active: bool
    image_input_active: bool
    time_limit: Optional[int]
    rubric_id: str
    scenario_ids: List[str]


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
    department_id: str
    active: bool
    default_simulation: bool
    practice_simulation: bool
    hints_enabled: bool
    input_guardrail_active: bool
    output_guardrail_active: bool
    image_input_active: bool
    time_limit: Optional[int]
    rubric_id: str
    scenario_ids: List[str]


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

