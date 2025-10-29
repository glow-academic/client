"""Scenarios V2 API schemas."""

from pydantic import BaseModel

from .base import (CohortMapping, DepartmentMapping, DocumentMapping,
                   ObjectiveMapping, ParameterItemMapping, ParameterMapping,
                   PersonaMapping, SimulationMapping)


class ScenariosFilters(BaseModel):
    """Filters for scenarios list request."""

    departmentIds: list[str]
    profileId: str


class ScenarioItem(BaseModel):
    """Individual scenario item in the response."""

    scenario_id: str
    title: str  # Maps to scenarios.name
    problem_statement: str
    active: bool
    generated: bool
    parent_scenario_id: str | None
    department_ids: list[str] | None  # None = cross-department (all departments)
    objective_ids: list[str]  # "scenarioId_idx" composite keys
    persona_id: str | None
    parameter_item_ids: list[str]
    simulation_ids: list[str]
    num_simulations: int
    can_edit: bool
    can_delete: bool
    can_duplicate: bool
    cohort_ids: list[str]


class ScenariosListResponse(BaseModel):
    """Response for scenarios list endpoint."""

    scenarios: list[ScenarioItem]
    objective_mapping: ObjectiveMapping
    parameter_item_mapping: ParameterItemMapping
    cohort_mapping: CohortMapping
    persona_mapping: PersonaMapping
    simulation_mapping: SimulationMapping


class ScenarioDetailRequest(BaseModel):
    """Request to get scenario details."""

    scenarioId: str
    profileId: str


class ParameterDetail(BaseModel):
    """Parameter detail structure."""

    parameter_item_ids: list[str]
    valid_parameter_item_ids: list[str]


class DocumentDetailItem(BaseModel):
    """Document detail for preview - matches client DocumentItem schema."""

    document_id: str
    name: str
    type: str
    updatedAt: str
    extension: str
    scenario_ids: list[str]
    can_edit: bool
    can_delete: bool
    active: bool
    department_ids: list[str] | None  # None = cross-department
    file_path: str
    mime_type: str
    parameter_item_ids: list[str]


class ScenarioDetailResponse(BaseModel):
    """Detailed scenario response with all fields and metadata."""

    # Basic fields
    name: str
    problem_statement: str
    active: bool
    generated: bool
    parent_scenario_id: str | None

    # Department
    department_ids: list[str] | None  # None = cross-department (all departments)
    valid_department_ids: list[str]

    # IDs
    persona_id: str | None
    valid_persona_ids: list[str]
    document_ids: list[str]
    valid_document_ids: list[str]

    # Objectives (use IDs)
    objective_ids: list[str]  # "scenarioId_idx" composite keys
    valid_objectives: list[str]  # Empty (free-form)

    # Parameters (structured by parameter_id)
    parameters: dict[str, ParameterDetail]

    # Simulations
    active_simulation_ids: list[str]

    # Document details (full objects for preview)
    document_details: list[DocumentDetailItem] = []

    # Permissions
    can_edit: bool
    can_duplicate: bool
    can_delete: bool

    # Top-level mappings
    parameter_mapping: ParameterMapping
    parameter_item_mapping: ParameterItemMapping
    simulation_mapping: SimulationMapping
    persona_mapping: PersonaMapping
    document_mapping: DocumentMapping
    objective_mapping: ObjectiveMapping
    department_mapping: DepartmentMapping


class ScenarioDetailDefaultRequest(BaseModel):
    """Request to get default scenario details."""

    profileId: str


class CreateScenarioRequest(BaseModel):
    """Request to create a scenario."""

    name: str
    problem_statement: str
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    active: bool
    persona_id: str | None
    document_ids: list[str]
    objective_ids: list[str]  # Can be composite IDs or raw text
    parameters: dict[str, list[str]]  # { parameter_id: [parameter_item_ids] }


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
    department_ids: list[str] | None  # None = cross-department (superadmin only)
    active: bool
    persona_id: str | None
    document_ids: list[str]
    objective_ids: list[str]
    parameters: dict[str, list[str]]


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


# ============================================================================
# AI GENERATION AND RANDOMIZATION
# ============================================================================


class GenerateScenarioAIRequest(BaseModel):
    """Request to generate AI scenario content."""

    departmentId: str
    personaId: str | None = None
    documentIds: list[str] | None = None
    parameterItemIds: list[str] | None = None
    profileId: str | None = None


class GenerateScenarioAIResponse(BaseModel):
    """Response from AI scenario generation."""

    success: bool
    message: str
    title: str
    description: str
    objectives: list[str]


class RandomizeScenarioRequest(BaseModel):
    """Request to randomize scenario sections."""

    name: str | None = None
    description: str | None = None
    personaId: str | None = None
    documentIds: list[str] | None = None
    parameterItemIds: list[str] | None = None
    targets: list[str] = []  # ["persona", "documents", "parameters"]


class RandomizeScenarioResponse(BaseModel):
    """Response from scenario randomization."""

    success: bool
    message: str
    personaId: str | None = None
    documentIds: list[str] = []
    parameterItemIds: list[str] = []
