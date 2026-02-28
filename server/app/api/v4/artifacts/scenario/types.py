"""Scenario API types - handcrafted types for scenario endpoints.

These types are used for the scenario API endpoints and include
Python-computed permissions and UI flags.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.artifacts.persona.types import ImportField
from app.api.v4.artifacts.types import InternalResponseBase
from app.api.v4.entries.runs.search import GetRunListViewResponse
from app.api.v4.types import BaseResourceSection, ListFilterSection
from app.sql.types import (
    QGetScenarioDraftsEntriesV4Item,
)

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


class GetScenarioWebsocketResponse(InternalResponseBase):
    """Minimal response for WebSocket handlers (get_scenario_websocket).

    Contains only what's needed for AI generation:
    - Group ID (for existing group context)
    - Optional draft view (for Jinja templates)
    - resource_agent_ids mapping (resource_type -> agent_id)
    - Resources (for Jinja template context)
    """

    entries: "ScenarioWebsocketEntries | None" = None

    resources: "ScenarioWebsocketResources"


class ScenarioWebsocketEntries(BaseModel):
    """Optional websocket entries payload."""

    draft_scenario: QGetScenarioDraftsEntriesV4Item | None = None
    runs: GetRunListViewResponse | None = None


class ScenarioWebsocketResources(BaseModel):
    """Hydrated resources for websocket — selected only, no `current` wrapper."""

    # 14 scenario resources (selected)
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
    fields: list[Any] | None = None


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
    total_count: int | None = None
    import_fields: list[ImportField] | None = None


# =============================================================================
# SAVE Endpoint Types
# =============================================================================


class SaveScenarioItem(BaseModel):
    """Per-item shape for saving a scenario — dual-mode fields (ID or value)."""

    input_scenario_id: UUID | None = None
    # Dual-mode: provide ID or raw value (value resolved to ID server-side)
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


class SaveScenarioApiRequest(BaseModel):
    """Bulk save request — wraps list of items."""

    scenarios: list[SaveScenarioItem]
    group_id: UUID | None = None  # Tool tracking context from GET response


class SaveScenarioFieldError(BaseModel):
    """Per-field validation error."""

    field: str
    message: str


class SaveScenarioResult(BaseModel):
    """Per-item result from bulk save."""

    success: bool = False
    scenario_id: UUID | None = None
    message: str | None = None
    errors: list[SaveScenarioFieldError] | None = None


class SaveScenarioApiResponse(BaseModel):
    """Bulk save response."""

    results: list[SaveScenarioResult]


class ScenarioResourceAction(BaseModel):
    """Internal type for SQL composite serialization (used by draft endpoint)."""

    resource_id: UUID | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class ScenarioMultiResourceAction(BaseModel):
    """Internal type for SQL composite serialization (used by draft endpoint)."""

    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


# =============================================================================
# EXPORT Endpoint Types
# =============================================================================


class ExportScenarioApiRequest(BaseModel):
    """Request model for export scenario endpoint."""

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

    scenario_id: UUID | None = None
    scenario_name: str | None = None
    actor_name: str | None = None


# =============================================================================
# DRAFT Endpoint Types
# =============================================================================


class PatchScenarioDraftApiRequest(BaseModel):
    """Request for patching a scenario draft - flat resource IDs."""

    input_draft_id: UUID | None = None
    expected_version: int = 0
    group_id: UUID | None = None  # Tool tracking context from GET response
    name_id: UUID | None = None
    description_id: UUID | None = None
    problem_statement_id: UUID | None = None
    active_flag_id: UUID | None = None
    objectives_enabled_flag_id: UUID | None = None
    images_enabled_flag_id: UUID | None = None
    video_enabled_flag_id: UUID | None = None
    questions_enabled_flag_id: UUID | None = None
    problem_statement_enabled_flag_id: UUID | None = None
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


class PatchScenarioDraftApiResponse(BaseModel):
    """Response for patching a scenario draft."""

    success: bool = False
    draft_id: UUID | None = None
    new_version: int | None = None
    message: str | None = None


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


class SaveScenarioSqlParams(BaseModel):
    """SQL parameters for save scenario — flat resource IDs, no composites."""

    profile_id: UUID
    input_scenario_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    problem_statement_id: UUID | None = None
    flag_ids: list[UUID] | None = None
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
    scenarios_resource_id: UUID | None = None

    @classmethod
    def from_request(
        cls,
        item: SaveScenarioItem,
        profile_id: UUID,
        scenarios_resource_id: UUID | None = None,
    ) -> "SaveScenarioSqlParams":
        flag_ids = [
            fid
            for fid in [
                item.active_flag_id,
                item.objectives_enabled_flag_id,
                item.images_enabled_flag_id,
                item.video_enabled_flag_id,
                item.questions_enabled_flag_id,
                item.problem_statement_enabled_flag_id,
            ]
            if fid is not None
        ]
        return cls(
            profile_id=profile_id,
            input_scenario_id=item.input_scenario_id,
            name_id=item.name_id,
            description_id=item.description_id,
            problem_statement_id=item.problem_statement_id,
            flag_ids=flag_ids or None,
            department_ids=item.department_ids,
            persona_ids=item.persona_ids,
            document_ids=item.document_ids,
            parameter_ids=item.parameter_ids,
            parameter_field_ids=item.parameter_field_ids,
            image_ids=item.image_ids,
            objective_ids=item.objective_ids,
            video_ids=item.video_ids,
            question_ids=item.question_ids,
            option_ids=item.option_ids,
            scenarios_resource_id=scenarios_resource_id,
        )

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.profile_id,
            self.input_scenario_id,
            self.name_id,
            self.description_id,
            self.problem_statement_id,
            self.flag_ids,
            self.department_ids or [],
            self.persona_ids or [],
            self.document_ids or [],
            self.parameter_ids,
            self.parameter_field_ids or [],
            self.image_ids or [],
            self.objective_ids or [],
            self.video_ids or [],
            self.question_ids or [],
            self.option_ids or [],
            self.scenarios_resource_id,
        )


class SaveScenarioSqlRow(BaseModel):
    """SQL row for save scenario."""

    scenario_id: UUID | None = None


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


class PatchScenarioDraftSqlParams(BaseModel):
    """SQL parameters for patch scenario draft - nested resource actions."""

    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: ScenarioResourceAction
    descriptions: ScenarioResourceAction
    problem_statements: ScenarioResourceAction
    flags: ScenarioMultiResourceAction
    departments: ScenarioMultiResourceAction
    personas: ScenarioMultiResourceAction
    documents: ScenarioMultiResourceAction
    parameters: ScenarioMultiResourceAction
    parameter_fields: ScenarioMultiResourceAction
    images: ScenarioMultiResourceAction
    objectives: ScenarioMultiResourceAction
    videos: ScenarioMultiResourceAction
    questions: ScenarioMultiResourceAction
    options: ScenarioMultiResourceAction
    expected_version: int = 0

    @classmethod
    def from_request(
        cls,
        request: PatchScenarioDraftApiRequest,
        profile_id: UUID,
        group_id: UUID | None,
    ) -> "PatchScenarioDraftSqlParams":
        empty_single = ScenarioResourceAction()
        empty_multi = ScenarioMultiResourceAction()

        # Build names/descriptions/problem_statements from flat fields
        names = (
            ScenarioResourceAction(resource_id=request.name_id)
            if request.name_id is not None
            else empty_single
        )
        descriptions = (
            ScenarioResourceAction(resource_id=request.description_id)
            if request.description_id is not None
            else empty_single
        )
        problem_statements = (
            ScenarioResourceAction(resource_id=request.problem_statement_id)
            if request.problem_statement_id is not None
            else empty_single
        )

        # Build flags from individual flag fields
        flag_ids = [
            fid
            for fid in [
                request.active_flag_id,
                request.objectives_enabled_flag_id,
                request.images_enabled_flag_id,
                request.video_enabled_flag_id,
                request.questions_enabled_flag_id,
                request.problem_statement_enabled_flag_id,
            ]
            if fid is not None
        ]
        has_any_flag_field = any(
            getattr(request, f) is not None
            for f in [
                "active_flag_id",
                "objectives_enabled_flag_id",
                "images_enabled_flag_id",
                "video_enabled_flag_id",
                "questions_enabled_flag_id",
                "problem_statement_enabled_flag_id",
            ]
        )
        flags = (
            ScenarioMultiResourceAction(resource_ids=flag_ids or None)
            if has_any_flag_field
            else empty_multi
        )

        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=group_id,
            names=names,
            descriptions=descriptions,
            problem_statements=problem_statements,
            flags=flags,
            departments=(
                ScenarioMultiResourceAction(resource_ids=request.department_ids)
                if request.department_ids is not None
                else empty_multi
            ),
            personas=(
                ScenarioMultiResourceAction(resource_ids=request.persona_ids)
                if request.persona_ids is not None
                else empty_multi
            ),
            documents=(
                ScenarioMultiResourceAction(resource_ids=request.document_ids)
                if request.document_ids is not None
                else empty_multi
            ),
            parameters=(
                ScenarioMultiResourceAction(resource_ids=request.parameter_ids)
                if request.parameter_ids is not None
                else empty_multi
            ),
            parameter_fields=(
                ScenarioMultiResourceAction(resource_ids=request.parameter_field_ids)
                if request.parameter_field_ids is not None
                else empty_multi
            ),
            images=(
                ScenarioMultiResourceAction(resource_ids=request.image_ids)
                if request.image_ids is not None
                else empty_multi
            ),
            objectives=(
                ScenarioMultiResourceAction(resource_ids=request.objective_ids)
                if request.objective_ids is not None
                else empty_multi
            ),
            videos=(
                ScenarioMultiResourceAction(resource_ids=request.video_ids)
                if request.video_ids is not None
                else empty_multi
            ),
            questions=(
                ScenarioMultiResourceAction(resource_ids=request.question_ids)
                if request.question_ids is not None
                else empty_multi
            ),
            options=(
                ScenarioMultiResourceAction(resource_ids=request.option_ids)
                if request.option_ids is not None
                else empty_multi
            ),
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple[Any, ...]:
        def single(a: ScenarioResourceAction) -> tuple[Any, Any, Any]:
            return (a.resource_id, a.create_tool_id, a.link_tool_id)

        def multi(a: ScenarioMultiResourceAction) -> tuple[Any, Any, Any]:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            single(self.names),
            single(self.descriptions),
            single(self.problem_statements),
            multi(self.flags),
            multi(self.departments),
            multi(self.personas),
            multi(self.documents),
            multi(self.parameters),
            multi(self.parameter_fields),
            multi(self.images),
            multi(self.objectives),
            multi(self.videos),
            multi(self.questions),
            multi(self.options),
            self.expected_version,
        )


class PatchScenarioDraftSqlRow(BaseModel):
    """SQL row for patch scenario draft."""

    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None
