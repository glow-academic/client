"""Scenario API types - handcrafted types for scenario endpoints.

These types are used for the scenario API endpoints and include
Python-computed permissions and UI flags.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.infra.scenario_create import CreateScenarioItem
from app.routes.v5.api.main.persona.types import ImportField
from app.routes.v5.api.types import BaseResourceSection, ListFilterSection
from app.routes.v5.tools.entries.scenario_drafts.types import GetScenarioDraftResponse

# =============================================================================
# Resource Types
# =============================================================================


class ScenarioNameResource(BaseModel):
    """Name resource for scenario."""

    id: UUID | None = None
    name: str | None = None
    generated: bool | None = None


class ScenarioDescriptionResource(BaseModel):
    """Description resource for scenario."""

    id: UUID | None = None
    description: str | None = None
    generated: bool | None = None


class ScenarioFlagResource(BaseModel):
    """Flag resource for scenario."""

    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    generated: bool | None = None


class ScenarioFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str  # e.g., "active", "objectives_enabled"
    label: str  # e.g., "Active", "Objectives Enabled"
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None  # ID to use when enabling
    show: bool = True
    required: bool = False
    generated: bool | None = None
    video_flag: bool | None = (
        None  # True if this flag only shows when video_enabled is true
    )


class ScenarioDepartment(BaseModel):
    """Department for scenario."""

    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None


class ScenarioPersona(BaseModel):
    """Persona for scenario."""

    persona_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    color: str | None = None
    icon: str | None = None
    image_model: bool | None = None
    parameter_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None
    example: str | None = None
    video_persona: bool | None = None  # Has linked parameter with video_parameter=true
    non_video_persona: bool | None = (
        None  # Has linked parameter with video_parameter=false
    )


class ScenarioObjective(BaseModel):
    """Objective for scenario."""

    id: UUID | None = None
    objective: str | None = None
    generated: bool | None = None


class ScenarioDocument(BaseModel):
    """Document for scenario."""

    document_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    file_path: str | None = None
    mime_type: str | None = None
    upload_id: UUID | None = None
    html: bool | None = None
    parameter_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None
    parent_document_id: UUID | None = None
    video_document: bool | None = None  # Has linked parameter with video_parameter=true
    non_video_document: bool | None = (
        None  # Has linked parameter with video_parameter=false
    )


class ScenarioParameter(BaseModel):
    """Parameter for scenario."""

    parameter_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    document_parameter: bool | None = None
    persona_parameter: bool | None = None
    scenario_parameter: bool | None = None
    video_parameter: bool | None = None
    non_video_parameter: bool | None = (
        None  # Inverse of video_parameter for frontend filtering
    )
    conditional: bool | None = None


class ScenarioField(BaseModel):
    """Field for scenario."""

    field_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    parameter_id: UUID | None = None
    parameter_name: str | None = None
    conditional_parameter_ids: list[UUID] | None = None
    generated: bool | None = None


class ScenarioImage(BaseModel):
    """Image for scenario."""

    image_id: UUID | None = None
    name: str | None = None
    file_path: str | None = None
    mime_type: str | None = None
    upload_id: UUID | None = None
    generated: bool | None = None


class ScenarioVideo(BaseModel):
    """Video for scenario."""

    video_id: UUID | None = None
    name: str | None = None
    file_path: str | None = None
    mime_type: str | None = None
    upload_id: UUID | None = None
    generated: bool | None = None


class ScenarioQuestion(BaseModel):
    """Question for scenario."""

    question_id: UUID | None = None
    question_text: str | None = None
    allow_multiple: bool | None = None
    generated: bool | None = None


class ScenarioOption(BaseModel):
    """Option for scenario."""

    option_id: UUID | None = None
    option_text: str | None = None
    is_correct: bool | None = None
    question_id: UUID | None = None
    generated: bool | None = None


class ScenarioProblemStatement(BaseModel):
    """Problem statement for scenario."""

    problem_statement_id: UUID | None = None
    name: str | None = None
    problem_statement: str | None = None
    generated: bool | None = None


class ScenarioFieldParamFilter(BaseModel):
    """Field parameter filter for show_selected filtering."""

    parameter_id: UUID | None = None
    show_selected: bool | None = None


# =============================================================================
# Resource Bucket Types (for three-layer architecture)
# =============================================================================


class ScenarioResourceBucket(BaseModel):
    """Generic resources bucket with full objects (always plural lists)."""

    names: list[ScenarioNameResource] | None = None
    descriptions: list[ScenarioDescriptionResource] | None = None
    problem_statements: list[ScenarioProblemStatement] | None = None
    flags: list[ScenarioFlagConfig] | None = None
    departments: list[ScenarioDepartment] | None = None
    personas: list[ScenarioPersona] | None = None
    documents: list[ScenarioDocument] | None = None
    parameters: list[ScenarioParameter] | None = None
    parameter_fields: list[ScenarioField] | None = None
    objectives: list[ScenarioObjective] | None = None
    images: list[ScenarioImage] | None = None
    videos: list[ScenarioVideo] | None = None
    questions: list[ScenarioQuestion] | None = None
    options: list[ScenarioOption] | None = None


class ScenarioResources(BaseModel):
    """Full resources + current selections."""

    resources: ScenarioResourceBucket | None = None
    current: ScenarioResourceBucket | None = None


# =============================================================================
# GET Endpoint Types
# =============================================================================


class GetScenarioApiRequest(BaseModel):
    """Request for getting a single scenario."""

    scenario_id: UUID | None = None
    document_ids: list[UUID] | None = None
    problem_statement_ids: list[UUID] | None = None
    filter_department_ids: list[UUID] | None = None
    filter_persona_ids: list[UUID] | None = None
    filter_document_ids: list[UUID] | None = None
    filter_parameter_ids: list[UUID] | None = None
    filter_field_ids: list[UUID] | None = None
    persona_search: str | None = None
    document_search: str | None = None
    parameter_search: str | None = None
    description_search: str | None = None
    problem_statement_search: str | None = None
    image_search: str | None = None
    video_search: str | None = None
    question_search: str | None = None
    option_search: str | None = None
    persona_show_selected: bool | None = None
    document_show_selected: bool | None = None
    parameter_show_selected: bool | None = None
    field_show_selected_by_param: list[ScenarioFieldParamFilter] | None = Field(
        default_factory=list
    )
    draft_id: UUID | None = None
    group_id: UUID | None = None
    mcp: bool | None = False
    parameter_ids: list[UUID] | None = None


class ScenarioNameSection(BaseResourceSection):
    resource: ScenarioNameResource | None = None
    resources: list[ScenarioNameResource] | None = None


class ScenarioDescriptionSection(BaseResourceSection):
    resource: ScenarioDescriptionResource | None = None
    resources: list[ScenarioDescriptionResource] | None = None


class ScenarioProblemStatementSection(BaseResourceSection):
    resource: ScenarioProblemStatement | None = None
    resources: list[ScenarioProblemStatement] | None = None


class ScenarioFlagSection(BaseResourceSection):
    current: list[ScenarioFlagConfig] | None = None
    resources: list[ScenarioFlagConfig] | None = None


class ScenarioDepartmentSection(BaseResourceSection):
    current: list[ScenarioDepartment] | None = None
    resources: list[ScenarioDepartment] | None = None


class ScenarioPersonaSection(BaseResourceSection):
    current: list[ScenarioPersona] | None = None
    resources: list[ScenarioPersona] | None = None


class ScenarioDocumentSection(BaseResourceSection):
    current: list[ScenarioDocument] | None = None
    resources: list[ScenarioDocument] | None = None


class ScenarioParameterSection(BaseResourceSection):
    current: list[ScenarioParameter] | None = None
    resources: list[ScenarioParameter] | None = None


class ScenarioParameterFieldSection(BaseResourceSection):
    current: list[ScenarioField] | None = None
    resources: list[ScenarioField] | None = None


class ScenarioObjectiveSection(BaseResourceSection):
    current: list[ScenarioObjective] | None = None
    resources: list[ScenarioObjective] | None = None


class ScenarioImageSection(BaseResourceSection):
    current: list[ScenarioImage] | None = None
    resources: list[ScenarioImage] | None = None


class ScenarioVideoSection(BaseResourceSection):
    current: list[ScenarioVideo] | None = None
    resources: list[ScenarioVideo] | None = None


class ScenarioQuestionSection(BaseResourceSection):
    current: list[ScenarioQuestion] | None = None
    resources: list[ScenarioQuestion] | None = None


class ScenarioOptionSection(BaseResourceSection):
    current: list[ScenarioOption] | None = None
    resources: list[ScenarioOption] | None = None


class GetScenarioApiResponse(BaseModel):
    """Response for getting a single scenario."""

    # Context
    actor_name: str | None = None
    scenario_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    # Step-level AI generation flags
    basic_show_ai_generate: bool | None = None
    content_show_ai_generate: bool | None = None

    # Resolved parameter IDs (derived from saved parameter_fields)
    resolved_parameter_ids: list[str] | None = None

    # Per-resource sections
    names: ScenarioNameSection | None = None
    descriptions: ScenarioDescriptionSection | None = None
    problem_statements: ScenarioProblemStatementSection | None = None
    flags: ScenarioFlagSection | None = None
    departments: ScenarioDepartmentSection | None = None
    personas: ScenarioPersonaSection | None = None
    documents: ScenarioDocumentSection | None = None
    parameters: ScenarioParameterSection | None = None
    parameter_fields: ScenarioParameterFieldSection | None = None
    objectives: ScenarioObjectiveSection | None = None
    images: ScenarioImageSection | None = None
    videos: ScenarioVideoSection | None = None
    questions: ScenarioQuestionSection | None = None
    options: ScenarioOptionSection | None = None


# =============================================================================
# LIST Endpoint Types
# =============================================================================


class ListScenarioApiScenario(BaseModel):
    """Scenario item in list response with Python-computed permissions."""

    scenario_id: UUID | None = None
    name: str | None = None
    problem_statement: str | None = None
    is_inactive: bool | None = None
    generated: bool | None = None
    mcp: bool | None = None
    department_ids: list[str] | None = None
    objective_ids: list[str] | None = None
    persona_ids: list[str] | None = None
    field_ids: list[str] | None = None
    simulation_ids: list[str] | None = None
    num_simulations: int | None = None
    active_simulation_count: int | None = None
    can_edit: bool | None = None
    can_delete: bool | None = None
    can_duplicate: bool | None = None
    cohort_ids: list[str] | None = None
    updated_at: datetime | None = None


class ListScenarioApiObjective(BaseModel):
    """Objective in list response."""

    objective_id: str | None = None
    name: str | None = None
    description: str | None = None


class ListScenarioApiField(BaseModel):
    """Field in list response."""

    field_id: str | None = None
    name: str | None = None
    description: str | None = None


class ListScenarioApiCohort(BaseModel):
    """Cohort in list response."""

    cohort_id: str | None = None
    name: str | None = None
    description: str | None = None


class ListScenarioApiPersona(BaseModel):
    """Persona in list response."""

    persona_id: str | None = None
    name: str | None = None
    description: str | None = None
    color: str | None = None
    icon: str | None = None


class ListScenarioApiSimulation(BaseModel):
    """Simulation in list response."""

    simulation_id: str | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None


class ListScenarioApiDepartment(BaseModel):
    """Department in list response."""

    department_id: str | None = None
    name: str | None = None
    description: str | None = None


class ListScenarioApiResponse(BaseModel):
    """Response for listing scenarios."""

    actor_name: str | None = None
    scenarios: list[ListScenarioApiScenario] | None = None
    objectives: list[ListScenarioApiObjective] | None = None
    fields: list[ListScenarioApiField] | None = None
    cohorts: list[ListScenarioApiCohort] | None = None
    personas: list[ListScenarioApiPersona] | None = None
    simulations: list[ListScenarioApiSimulation] | None = None
    departments: list[ListScenarioApiDepartment] | None = None
    persona_filter: "ListFilterSection | None" = None
    simulation_filter: "ListFilterSection | None" = None
    department_filter: "ListFilterSection | None" = None
    flag_filter: "ListFilterSection | None" = None
    total_count: int | None = None
    import_fields: list[ImportField] | None = None


# =============================================================================
# Shared Save/Create/Update Types
# =============================================================================


class ScenarioFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class ScenarioResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    scenario_id: UUID | None = None
    message: str
    errors: list[ScenarioFieldError] | None = None


# =============================================================================
# Create Endpoint Types
# =============================================================================


class CreateScenarioApiRequest(BaseModel):
    """Request model for bulk create scenario endpoint."""

    scenarios: list[CreateScenarioItem]
    group_id: UUID | None = None


class CreateScenarioApiResponse(BaseModel):
    """Response model for bulk create scenario endpoint."""

    results: list[ScenarioResultItem]


# =============================================================================
# Update Endpoint Types
# =============================================================================


class UpdateScenarioItem(BaseModel):
    """Single scenario item for update — scenario_id required, all fields optional.

    Only provided fields are updated (partial update).
    """

    scenario_id: UUID  # Required — which scenario to update
    # Dual-mode: provide ID or raw value
    name_id: UUID | None = None
    name: str | None = None
    description_id: UUID | None = None
    description: str | None = None
    problem_statement_id: UUID | None = None
    problem_statement: str | None = None
    # Flag IDs (individual typed flags)
    active_flag_id: UUID | None = None
    objectives_enabled_flag_id: UUID | None = None
    images_enabled_flag_id: UUID | None = None
    video_enabled_flag_id: UUID | None = None
    questions_enabled_flag_id: UUID | None = None
    problem_statement_enabled_flag_id: UUID | None = None
    # Multi-select resource IDs
    department_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    objective_ids: list[UUID] | None = None
    video_ids: list[UUID] | None = None
    question_ids: list[UUID] | None = None
    option_ids: list[UUID] | None = None
    # Value-based fields for CSV import (resolved to IDs server-side)
    active_flag: bool | None = None
    departments: list[str] | None = None
    personas: list[str] | None = None
    documents: list[str] | None = None
    parameter_fields: list[str] | None = None
    objectives: list[str] | None = None
    images: list[str] | None = None
    videos: list[str] | None = None
    questions: list[str] | None = None
    options: list[str] | None = None


class UpdateScenarioApiRequest(BaseModel):
    """Request model for bulk update scenario endpoint."""

    scenarios: list[UpdateScenarioItem]
    group_id: UUID | None = None


class UpdateScenarioApiResponse(BaseModel):
    """Response model for bulk update scenario endpoint."""

    results: list[ScenarioResultItem]


class SaveScenarioFieldError(BaseModel):
    """Per-field validation error."""

    field: str
    message: str


# =============================================================================
# EXPORT Endpoint Types
# =============================================================================


class ExportScenarioApiRequest(BaseModel):
    """Request model for export scenario endpoint."""

    scenario_id: UUID | None = None

    search: str | None = None
    persona_ids: list[str] | None = None
    simulation_ids: list[str] | None = None
    filter_department_ids: list[str] | None = None


class ExportScenarioApiResponse(BaseModel):
    """Response model for export scenario endpoint."""

    upload_id: UUID
    file_name: str
    row_count: int


# =============================================================================
# DELETE Endpoint Types
# =============================================================================


class DeleteScenarioApiRequest(BaseModel):
    """Bulk delete request."""

    scenario_ids: list[UUID]


class DeleteScenarioResult(BaseModel):
    """Per-item result from bulk delete."""

    success: bool = False
    scenario_id: UUID | None = None
    message: str | None = None


class DeleteScenarioApiResponse(BaseModel):
    """Bulk delete response."""

    results: list[DeleteScenarioResult]


# =============================================================================
# DUPLICATE Endpoint Types
# =============================================================================


class DuplicateScenarioApiRequest(BaseModel):
    """Request for duplicating a scenario."""

    scenario_id: UUID
    group_id: UUID | None = None


class DuplicateScenarioApiResponse(BaseModel):
    """Response for duplicating a scenario."""

    success: bool
    scenario_id: UUID
    message: str


# =============================================================================
# DRAFT Endpoint Types
# =============================================================================


class DraftObjectiveValue(BaseModel):
    """Value for creating an objective via the draft endpoint."""

    objective: str


class DraftImageValue(BaseModel):
    """Value for creating an image via the draft endpoint."""

    name: str
    description: str
    upload_id: UUID | None = (
        None  # TODO: wire upload_id through create_image + create_image_upload
    )


class DraftVideoValue(BaseModel):
    """Value for creating a video via the draft endpoint."""

    name: str
    description: str
    upload_id: UUID | None = (
        None  # TODO: wire upload_id through create_video + create_video_upload
    )
    length_seconds: int = 0


class DraftQuestionValue(BaseModel):
    """Value for creating a question via the draft endpoint."""

    question_text: str
    time: int = 30
    allow_multiple: bool = False


class DraftOptionValue(BaseModel):
    """Value for creating an option via the draft endpoint."""

    option_text: str
    question_id: UUID | None = None


class PatchScenarioDraftApiRequest(BaseModel):
    """Request model for new-style scenario draft endpoint.

    Dual-mode for creatable resources:
      - Single-select: name/name_id, description/description_id,
        problem_statement/problem_statement_id
      - Multi-select (merged): objectives/objective_ids, images/image_ids,
        videos/video_ids, questions/question_ids, options/option_ids
        (values are created as resources, then IDs are merged with existing IDs)

    ID-only for non-creatable resources:
      - flag_ids, department_ids, persona_ids, document_ids, parameter_field_ids

    Client always sends full state (append-only — each write is a new version snapshot).
    """

    group_id: UUID | None = None
    input_draft_id: UUID | None = None
    expected_version: int = 0

    # Creatable single-select — provide value or ID
    name: str | None = None
    name_id: UUID | None = None
    description: str | None = None
    description_id: UUID | None = None
    problem_statement: str | None = None
    problem_statement_id: UUID | None = None

    # Creatable multi-select — values merged with IDs
    objectives: list[str] | None = None
    objective_ids: list[UUID] | None = None
    images: list[DraftImageValue] | None = None
    image_ids: list[UUID] | None = None
    videos: list[DraftVideoValue] | None = None
    video_ids: list[UUID] | None = None
    questions: list[DraftQuestionValue] | None = None
    question_ids: list[UUID] | None = None
    options: list[DraftOptionValue] | None = None
    option_ids: list[UUID] | None = None

    # Non-creatable — ID-only
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None


class ScenarioDraftFormState(BaseModel):
    """Full form state after draft patch — server is source of truth.

    Client replaces its local form state with this after every successful patch.
    """

    name_id: UUID | None = None
    description_id: UUID | None = None
    problem_statement_id: UUID | None = None
    flag_ids: list[UUID] = []
    department_ids: list[UUID] = []
    persona_ids: list[UUID] = []
    document_ids: list[UUID] = []
    parameter_field_ids: list[UUID] = []
    objective_ids: list[UUID] = []
    image_ids: list[UUID] = []
    video_ids: list[UUID] = []
    question_ids: list[UUID] = []
    option_ids: list[UUID] = []


class PatchScenarioDraftApiResponse(BaseModel):
    """Response model for new-style scenario draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str
    form_state: ScenarioDraftFormState


class GetScenarioDraftsApiResponse(BaseModel):
    """Response model for scenario drafts list endpoint."""

    entries: list[GetScenarioDraftResponse] | None = None


# =============================================================================
# SQL Row Types (for internal use)
# =============================================================================


class ListScenarioSqlScenario(BaseModel):
    """Raw scenario from SQL — permissions computed in Python."""

    scenario_id: UUID | None = None
    name: str | None = None
    problem_statement: str | None = None
    is_inactive: bool | None = None
    generated: bool | None = None
    mcp: bool | None = None
    department_ids: list[str] | None = None
    objective_ids: list[str] | None = None
    persona_ids: list[str] | None = None
    field_ids: list[str] | None = None
    simulation_ids: list[str] | None = None
    num_simulations: int | None = None
    active_simulation_count: int | None = None
    cohort_ids: list[str] | None = None
    updated_at: datetime | None = None


class ListScenarioSqlRow(BaseModel):
    """Raw SQL row for list scenarios (mapping arrays hydrated in Python)."""

    actor_name: str | None = None
    user_role: str | None = None
    scenarios: list[ListScenarioSqlScenario] | None = None
    persona_options: list[dict] | None = None
    simulation_options: list[dict] | None = None
    department_options: list[dict] | None = None
    total_count: int | None = None


# =============================================================================
# SQL Params Types (for internal use)
# =============================================================================


class GetScenarioSqlParams(BaseModel):
    """SQL parameters for get scenario."""

    profile_id: UUID
    scenario_id: UUID | None = None
    document_ids: list[UUID] | None = None
    problem_statement_ids: list[UUID] | None = None
    filter_department_ids: list[UUID] | None = None
    filter_persona_ids: list[UUID] | None = None
    filter_document_ids: list[UUID] | None = None
    filter_parameter_ids: list[UUID] | None = None
    filter_field_ids: list[UUID] | None = None
    persona_search: str | None = None
    document_search: str | None = None
    parameter_search: str | None = None
    description_search: str | None = None
    problem_statement_search: str | None = None
    image_search: str | None = None
    video_search: str | None = None
    question_search: str | None = None
    option_search: str | None = None
    persona_show_selected: bool | None = None
    document_show_selected: bool | None = None
    parameter_show_selected: bool | None = None
    field_show_selected_by_param: list[ScenarioFieldParamFilter] | None = Field(
        default_factory=list
    )
    draft_id: UUID | None = None
    mcp: bool | None = False

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert to tuple for SQL execution."""
        field_show_selected_by_param_tuples = [
            (conn.parameter_id, conn.show_selected)
            for conn in (self.field_show_selected_by_param or [])
        ]
        return (
            self.profile_id,
            self.scenario_id,
            self.document_ids,
            self.problem_statement_ids,
            self.filter_department_ids,
            self.filter_persona_ids,
            self.filter_document_ids,
            self.filter_parameter_ids,
            self.filter_field_ids,
            self.persona_search,
            self.document_search,
            self.parameter_search,
            self.description_search,
            self.problem_statement_search,
            self.image_search,
            self.video_search,
            self.question_search,
            self.persona_show_selected,
            self.document_show_selected,
            self.parameter_show_selected,
            field_show_selected_by_param_tuples,
            self.draft_id,
            self.mcp,
        )


class GetScenarioSqlRow(BaseModel):
    """SQL row for get scenario."""

    actor_name: str | None = None
    scenario_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    group_id: UUID | None = None
    name_id: UUID | None = None
    name_resource: ScenarioNameResource | None = None
    show_name: bool | None = None
    name_required: bool | None = None
    name_suggestions: list[UUID] | None = None
    names: list[ScenarioNameResource] | None = None
    description_id: UUID | None = None
    description_resource: ScenarioDescriptionResource | None = None
    show_description: bool | None = None
    description_required: bool | None = None
    description_suggestions: list[UUID] | None = None
    descriptions: list[ScenarioDescriptionResource] | None = None
    problem_statement_id: UUID | None = None
    problem_statement_resource: ScenarioProblemStatement | None = None
    show_problem_statement: bool | None = None
    problem_statement_required: bool | None = None
    problem_statement_suggestions: list[UUID] | None = None
    problem_statements: list[ScenarioProblemStatement] | None = None
    active_flag_id: UUID | None = None
    active_flag_resource: ScenarioFlagResource | None = None
    show_active_flag: bool | None = None
    active_flag_required: bool | None = None
    objectives_enabled_flag_id: UUID | None = None
    objectives_enabled_flag_resource: ScenarioFlagResource | None = None
    show_objectives_enabled_flag: bool | None = None
    objectives_enabled_flag_required: bool | None = None
    images_enabled_flag_id: UUID | None = None
    images_enabled_flag_resource: ScenarioFlagResource | None = None
    show_images_enabled_flag: bool | None = None
    images_enabled_flag_required: bool | None = None
    video_enabled_flag_id: UUID | None = None
    video_enabled_flag_resource: ScenarioFlagResource | None = None
    show_video_enabled_flag: bool | None = None
    video_enabled_flag_required: bool | None = None
    questions_enabled_flag_id: UUID | None = None
    questions_enabled_flag_resource: ScenarioFlagResource | None = None
    show_questions_enabled_flag: bool | None = None
    questions_enabled_flag_required: bool | None = None
    problem_statement_enabled_flag_id: UUID | None = None
    problem_statement_enabled_flag_resource: ScenarioFlagResource | None = None
    show_problem_statement_enabled_flag: bool | None = None
    problem_statement_enabled_flag_required: bool | None = None
    department_ids: list[UUID] | None = None
    department_resources: list[ScenarioDepartment] | None = None
    show_departments: bool | None = None
    departments_required: bool | None = None
    department_suggestions: list[UUID] | None = None
    departments: list[ScenarioDepartment] | None = None
    parameter_field_ids: list[UUID] | None = None
    parameter_field_resources: list[ScenarioField] | None = None
    show_parameter_fields: bool | None = None
    parameter_fields_required: bool | None = None
    parameter_fields: list[ScenarioField] | None = None
    objective_ids: list[UUID] | None = None
    objective_resources: list[ScenarioObjective] | None = None
    show_objectives: bool | None = None
    objectives_required: bool | None = None
    objective_suggestions: list[UUID] | None = None
    objectives: list[ScenarioObjective] | None = None
    image_ids: list[UUID] | None = None
    image_resources: list[ScenarioImage] | None = None
    show_images: bool | None = None
    images_required: bool | None = None
    image_suggestions: list[UUID] | None = None
    images: list[ScenarioImage] | None = None
    video_ids: list[UUID] | None = None
    video_resources: list[ScenarioVideo] | None = None
    show_videos: bool | None = None
    videos_required: bool | None = None
    video_suggestions: list[UUID] | None = None
    videos: list[ScenarioVideo] | None = None
    question_ids: list[UUID] | None = None
    question_resources: list[ScenarioQuestion] | None = None
    show_questions: bool | None = None
    questions_required: bool | None = None
    question_suggestions: list[UUID] | None = None
    questions: list[ScenarioQuestion] | None = None
    option_ids: list[UUID] | None = None
    option_resources: list[ScenarioOption] | None = None
    show_options: bool | None = None
    options_required: bool | None = None
    option_suggestions: list[UUID] | None = None
    options: list[ScenarioOption] | None = None
    persona_ids: list[UUID] | None = None
    persona_resources: list[ScenarioPersona] | None = None
    show_personas: bool | None = None
    personas_required: bool | None = None
    persona_suggestions: list[UUID] | None = None
    personas: list[ScenarioPersona] | None = None
    document_ids: list[UUID] | None = None
    document_resources: list[ScenarioDocument] | None = None
    show_documents: bool | None = None
    documents_required: bool | None = None
    document_suggestions: list[UUID] | None = None
    documents: list[ScenarioDocument] | None = None
    parameter_ids: list[UUID] | None = None
    parameter_resources: list[ScenarioParameter] | None = None
    show_parameters: bool | None = None
    parameters_required: bool | None = None
    parameter_suggestions: list[UUID] | None = None
    parameters: list[ScenarioParameter] | None = None


class GetScenariosListSqlParams(BaseModel):
    """SQL parameters for list scenarios."""

    profile_id: UUID
    search: str | None = None
    persona_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    filter_department_ids: list[UUID] | None = None
    persona_search: str | None = None
    simulation_search: str | None = None
    department_search: str | None = None
    page_size: int | None = 10
    page_offset: int | None = 0

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert to tuple for SQL execution."""
        return (
            self.profile_id,
            self.search,
            self.persona_ids,
            self.simulation_ids,
            self.filter_department_ids,
            self.persona_search,
            self.simulation_search,
            self.department_search,
            self.page_size,
            self.page_offset,
        )


class GetScenariosListApiRequest(BaseModel):
    """Request for listing scenarios."""

    search: str | None = None
    persona_ids: list[UUID] | None = None
    simulation_ids: list[UUID] | None = None
    filter_department_ids: list[UUID] | None = None
    persona_search: str | None = None
    simulation_search: str | None = None
    department_search: str | None = None
    page_size: int | None = 10
    page_offset: int | None = 0


class DuplicateScenarioSqlParams(BaseModel):
    """SQL parameters for duplicate scenario."""

    scenario_id: UUID
    profile_id: UUID
    group_id: UUID | None = None

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert to tuple for SQL execution."""
        return (
            self.scenario_id,
            self.profile_id,
            self.group_id,
        )


class DuplicateScenarioSqlRow(BaseModel):
    """SQL row for duplicate scenario."""

    scenario_id: UUID | None = None
    scenario_name: str | None = None
    actor_name: str | None = None
