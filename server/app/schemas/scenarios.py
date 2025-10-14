"""Scenarios V2 API schemas."""

from typing import Dict, List, Optional

from pydantic import BaseModel

from .base import (CohortMapping, DocumentMapping, ObjectiveMapping,
                   ParameterItemMapping, ParameterMapping, PersonaMapping,
                   SimulationMapping)


class ScenariosFilters(BaseModel):
    """Filters for scenarios list request."""

    departmentIds: List[str]
    profileId: str


class ScenarioItem(BaseModel):
    """Individual scenario item in the response."""

    scenario_id: str
    title: str  # Maps to scenarios.name
    problem_statement: str
    active: bool
    default_scenario: bool
    generated: bool
    parent_scenario_id: Optional[str]
    objective_ids: List[str]  # "scenarioId_idx" composite keys
    persona_id: Optional[str]
    parameter_item_ids: List[str]
    simulation_ids: List[str]
    num_simulations: int
    can_edit: bool
    can_delete: bool
    can_duplicate: bool
    cohort_ids: List[str]


class ScenariosListResponse(BaseModel):
    """Response for scenarios list endpoint."""

    scenarios: List[ScenarioItem]
    objective_mapping: ObjectiveMapping
    parameter_item_mapping: ParameterItemMapping
    cohort_mapping: CohortMapping
    persona_mapping: PersonaMapping


class ScenarioDetailRequest(BaseModel):
    """Request to get scenario details."""

    scenarioId: str
    profileId: str


class ParameterDetail(BaseModel):
    """Parameter detail structure."""

    parameter_item_ids: List[str]
    valid_parameter_item_ids: List[str]


class ScenarioDetailResponse(BaseModel):
    """Detailed scenario response with all fields and metadata."""

    # Basic fields
    name: str
    problem_statement: str
    active: bool
    default_scenario: bool

    # IDs
    persona_id: Optional[str]
    valid_persona_ids: List[str]
    document_ids: List[str]
    valid_document_ids: List[str]

    # Objectives (use IDs)
    objective_ids: List[str]  # "scenarioId_idx" composite keys
    valid_objectives: List[str]  # Empty (free-form)

    # Parameters (structured by parameter_id)
    parameters: Dict[str, ParameterDetail]

    # Simulations
    active_simulation_ids: List[str]

    # Top-level mappings
    parameter_mapping: ParameterMapping
    parameter_item_mapping: ParameterItemMapping
    simulation_mapping: SimulationMapping
    persona_mapping: PersonaMapping
    document_mapping: DocumentMapping
    objective_mapping: ObjectiveMapping


class ScenarioDetailDefaultRequest(BaseModel):
    """Request to get default scenario details."""

    profileId: str


class CreateScenarioRequest(BaseModel):
    """Request to create a scenario."""

    name: str
    problem_statement: str
    department_id: str
    active: bool
    default_scenario: bool
    persona_id: Optional[str]
    document_ids: List[str]
    objective_ids: List[str]  # Can be composite IDs or raw text
    parameters: Dict[str, List[str]]  # { parameter_id: [parameter_item_ids] }


class CreateScenarioResponse(BaseModel):
    """Response from create operation."""

    success: bool
    scenarioId: str
    message: str


class UpdateScenarioRequest(BaseModel):
    """Request to update a scenario."""

    scenarioId: str
    name: str
    problem_statement: str
    department_id: str
    active: bool
    default_scenario: bool
    persona_id: Optional[str]
    document_ids: List[str]
    objective_ids: List[str]
    parameters: Dict[str, List[str]]


class UpdateScenarioResponse(BaseModel):
    """Response from update operation."""

    success: bool
    message: str


class DuplicateScenarioRequest(BaseModel):
    """Request to duplicate a scenario."""

    scenarioId: str


class DuplicateScenarioResponse(BaseModel):
    """Response from duplicate operation."""

    success: bool
    scenarioId: str
    message: str


class DeleteScenarioRequest(BaseModel):
    """Request to delete a scenario."""

    scenarioId: str


class DeleteScenarioResponse(BaseModel):
    """Response from delete operation."""

    success: bool
    message: str

