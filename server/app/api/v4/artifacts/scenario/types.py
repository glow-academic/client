"""Scenario API types - handcrafted types for scenario endpoints.

These types are used for the scenario API endpoints and include
Python-computed permissions and UI flags.
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

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
    agent_id: UUID | None = None
    generated: bool | None = None
    video_flag: bool | None = None  # True if this flag only shows when video_enabled is true


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
    non_video_persona: bool | None = None  # Has linked parameter with video_parameter=false


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
    parameter_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None
    parent_document_id: UUID | None = None
    video_document: bool | None = None  # Has linked parameter with video_parameter=true
    non_video_document: bool | None = None  # Has linked parameter with video_parameter=false


class ScenarioTemplate(BaseModel):
    """Template for scenario."""

    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    html: str | None = None
    generated: bool | None = None


class ScenarioParameter(BaseModel):
    """Parameter for scenario."""

    parameter_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    document_parameter: bool | None = None
    persona_parameter: bool | None = None
    scenario_parameter: bool | None = None
    video_parameter: bool | None = None
    non_video_parameter: bool | None = None  # Inverse of video_parameter for frontend filtering


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

    id: UUID | None = None
    name: str | None = None
    file_path: str | None = None
    mime_type: str | None = None
    upload_id: UUID | None = None
    generated: bool | None = None


class ScenarioVideo(BaseModel):
    """Video for scenario."""

    id: UUID | None = None
    name: str | None = None
    length_seconds: int | None = None
    completed: bool | None = None
    file_path: str | None = None
    mime_type: str | None = None
    upload_id: UUID | None = None
    generated: bool | None = None


class ScenarioQuestion(BaseModel):
    """Question for scenario."""

    id: UUID | None = None
    question_text: str | None = None
    allow_multiple: bool | None = None
    generated: bool | None = None


class ScenarioProblemStatement(BaseModel):
    """Problem statement for scenario."""

    id: UUID | None = None
    name: str | None = None
    problem_statement: str | None = None
    generated: bool | None = None


class ScenarioFieldParamFilter(BaseModel):
    """Field parameter filter for show_selected filtering."""

    parameter_id: UUID | None = None
    show_selected: bool | None = None


# =============================================================================
# GET Endpoint Types
# =============================================================================


class GetScenarioApiRequest(BaseModel):
    """Request for getting a single scenario."""

    scenario_id: UUID | None = None
    document_ids: list[UUID] | None = None
    problem_statement_ids: list[UUID] | None = None
    template_document_ids: list[UUID] | None = None
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
    template_search: str | None = None
    image_search: str | None = None
    video_search: str | None = None
    question_search: str | None = None
    persona_show_selected: bool | None = None
    document_show_selected: bool | None = None
    parameter_show_selected: bool | None = None
    field_show_selected_by_param: list[ScenarioFieldParamFilter] | None = Field(
        default_factory=list
    )
    draft_id: UUID | None = None
    mcp: bool | None = False


class GetScenarioApiResponse(BaseModel):
    """Response for getting a single scenario."""

    # Required metadata fields
    actor_name: str | None = None
    scenario_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    group_id: UUID | None = None

    # Name resource
    name_id: UUID | None = None
    name_resource: ScenarioNameResource | None = None
    show_name: bool | None = None
    name_agent_id: UUID | None = None
    name_required: bool | None = None
    name_suggestions: list[UUID] | None = None
    names: list[ScenarioNameResource] | None = None

    # Description resource
    description_id: UUID | None = None
    description_resource: ScenarioDescriptionResource | None = None
    show_description: bool | None = None
    description_agent_id: UUID | None = None
    description_required: bool | None = None
    description_suggestions: list[UUID] | None = None
    descriptions: list[ScenarioDescriptionResource] | None = None

    # Problem statement resource
    problem_statement_id: UUID | None = None
    problem_statement_resource: ScenarioProblemStatement | None = None
    show_problem_statement: bool | None = None
    problem_statement_agent_id: UUID | None = None
    problem_statement_required: bool | None = None
    problem_statement_suggestions: list[UUID] | None = None
    problem_statements: list[ScenarioProblemStatement] | None = None

    # Active flag resource
    active_flag_id: UUID | None = None
    active_flag_resource: ScenarioFlagResource | None = None
    show_active_flag: bool | None = None
    active_flag_agent_id: UUID | None = None
    active_flag_required: bool | None = None

    # Objectives enabled flag
    objectives_enabled_flag_id: UUID | None = None
    objectives_enabled_flag_resource: ScenarioFlagResource | None = None
    show_objectives_enabled_flag: bool | None = None
    objectives_enabled_flag_agent_id: UUID | None = None
    objectives_enabled_flag_required: bool | None = None

    # Images enabled flag
    images_enabled_flag_id: UUID | None = None
    images_enabled_flag_resource: ScenarioFlagResource | None = None
    show_images_enabled_flag: bool | None = None
    images_enabled_flag_agent_id: UUID | None = None
    images_enabled_flag_required: bool | None = None

    # Video enabled flag
    video_enabled_flag_id: UUID | None = None
    video_enabled_flag_resource: ScenarioFlagResource | None = None
    show_video_enabled_flag: bool | None = None
    video_enabled_flag_agent_id: UUID | None = None
    video_enabled_flag_required: bool | None = None

    # Questions enabled flag
    questions_enabled_flag_id: UUID | None = None
    questions_enabled_flag_resource: ScenarioFlagResource | None = None
    show_questions_enabled_flag: bool | None = None
    questions_enabled_flag_agent_id: UUID | None = None
    questions_enabled_flag_required: bool | None = None

    # Problem statement enabled flag
    problem_statement_enabled_flag_id: UUID | None = None
    problem_statement_enabled_flag_resource: ScenarioFlagResource | None = None
    show_problem_statement_enabled_flag: bool | None = None
    problem_statement_enabled_flag_agent_id: UUID | None = None
    problem_statement_enabled_flag_required: bool | None = None

    # Use templates flag
    use_templates_flag_id: UUID | None = None
    use_templates_flag_resource: ScenarioFlagResource | None = None
    show_use_templates_flag: bool | None = None
    use_templates_flag_agent_id: UUID | None = None
    use_templates_flag_required: bool | None = None

    # Server-driven flags array (enriched configs for all flags)
    flags: list[ScenarioFlagConfig] | None = None
    show_flags: bool | None = None  # Master visibility for all flags

    # Departments
    department_ids: list[UUID] | None = None
    department_resources: list[ScenarioDepartment] | None = None
    show_departments: bool | None = None
    departments_agent_id: UUID | None = None
    departments_required: bool | None = None
    department_suggestions: list[UUID] | None = None
    departments: list[ScenarioDepartment] | None = None

    # Parameter fields
    parameter_field_ids: list[UUID] | None = None
    parameter_field_resources: list[ScenarioField] | None = None
    show_parameter_fields: bool | None = None
    parameter_fields_agent_id: UUID | None = None
    parameter_fields_required: bool | None = None
    parameter_fields: list[ScenarioField] | None = None

    # Objectives
    objective_ids: list[UUID] | None = None
    objective_resources: list[ScenarioObjective] | None = None
    show_objectives: bool | None = None
    objectives_agent_id: UUID | None = None
    objectives_required: bool | None = None
    objective_suggestions: list[UUID] | None = None
    objectives: list[ScenarioObjective] | None = None

    # Images
    image_ids: list[UUID] | None = None
    image_resources: list[ScenarioImage] | None = None
    show_images: bool | None = None
    images_agent_id: UUID | None = None
    images_required: bool | None = None
    image_suggestions: list[UUID] | None = None
    images: list[ScenarioImage] | None = None

    # Videos
    video_ids: list[UUID] | None = None
    video_resources: list[ScenarioVideo] | None = None
    show_videos: bool | None = None
    videos_agent_id: UUID | None = None
    videos_required: bool | None = None
    video_suggestions: list[UUID] | None = None
    videos: list[ScenarioVideo] | None = None

    # Questions
    question_ids: list[UUID] | None = None
    question_resources: list[ScenarioQuestion] | None = None
    show_questions: bool | None = None
    questions_agent_id: UUID | None = None
    questions_required: bool | None = None
    question_suggestions: list[UUID] | None = None
    questions: list[ScenarioQuestion] | None = None

    # Templates
    template_ids: list[UUID] | None = None
    template_resources: list[ScenarioTemplate] | None = None
    show_templates: bool | None = None
    templates_agent_id: UUID | None = None
    templates_required: bool | None = None
    template_suggestions: list[UUID] | None = None
    templates: list[ScenarioTemplate] | None = None

    # Personas
    persona_ids: list[UUID] | None = None
    persona_resources: list[ScenarioPersona] | None = None
    show_personas: bool | None = None
    personas_agent_id: UUID | None = None
    personas_required: bool | None = None
    persona_suggestions: list[UUID] | None = None
    personas: list[ScenarioPersona] | None = None

    # Documents
    document_ids: list[UUID] | None = None
    document_resources: list[ScenarioDocument] | None = None
    show_documents: bool | None = None
    documents_agent_id: UUID | None = None
    documents_required: bool | None = None
    document_suggestions: list[UUID] | None = None
    documents: list[ScenarioDocument] | None = None

    # Parameters
    parameter_ids: list[UUID] | None = None
    parameter_resources: list[ScenarioParameter] | None = None
    show_parameters: bool | None = None
    parameters_agent_id: UUID | None = None
    parameters_required: bool | None = None
    parameter_suggestions: list[UUID] | None = None
    parameters: list[ScenarioParameter] | None = None

    # Multi-resource combination agent IDs
    basic_agent_id: UUID | None = None
    content_agent_id: UUID | None = None


# =============================================================================
# LIST Endpoint Types
# =============================================================================


class ListScenarioApiScenario(BaseModel):
    """Scenario item in list response with Python-computed permissions."""

    scenario_id: UUID | None = None
    title: str | None = None
    problem_statement: str | None = None
    active: bool | None = None
    generated: bool | None = None
    parent_scenario_id: UUID | None = None
    department_ids: list[str] | None = None
    objective_ids: list[str] | None = None
    persona_ids: list[str] | None = None
    parameter_item_ids: list[str] | None = None
    simulation_ids: list[str] | None = None
    num_simulations: int | None = None
    cohort_ids: list[str] | None = None
    updated_at: str | None = None

    # Python-computed permissions
    can_edit: bool | None = None
    can_delete: bool | None = None
    can_duplicate: bool | None = None


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
    parameter_id: str | None = None
    parameter_name: str | None = None


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
    image_model: bool | None = None


class ListScenarioApiSimulation(BaseModel):
    """Simulation in list response."""

    simulation_id: str | None = None
    name: str | None = None
    description: str | None = None
    time_limit: int | None = None
    department_ids: list[str] | None = None


class ListScenarioApiDepartment(BaseModel):
    """Department in list response."""

    department_id: str | None = None
    name: str | None = None
    description: str | None = None


class ListScenarioApiOption(BaseModel):
    """Option for facet filtering."""

    value: str | None = None
    label: str | None = None
    count: int | None = None


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
    persona_options: list[ListScenarioApiOption] | None = None
    simulation_options: list[ListScenarioApiOption] | None = None
    department_options: list[ListScenarioApiOption] | None = None
    total_count: int | None = None


# =============================================================================
# SAVE Endpoint Types
# =============================================================================


class SaveScenarioApiRequest(BaseModel):
    """Request for saving a scenario - accepts form data directly (no draft_id)."""

    # Context
    group_id: UUID  # REQUIRED - which group to save to
    input_scenario_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    problem_statement_id: UUID | None = None
    active_flag_id: UUID | None = None
    objectives_enabled_flag_id: UUID | None = None
    images_enabled_flag_id: UUID | None = None
    video_enabled_flag_id: UUID | None = None
    questions_enabled_flag_id: UUID | None = None
    problem_statement_enabled_flag_id: UUID | None = None
    use_templates_flag_id: UUID | None = None

    # Optional multi-select resources
    department_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    template_document_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    objective_ids: list[UUID] | None = None
    video_ids: list[UUID] | None = None
    question_ids: list[UUID] | None = None


class SaveScenarioApiResponse(BaseModel):
    """Response for saving a scenario."""

    scenario_id: UUID | None = None
    actor_name: str | None = None


# =============================================================================
# DELETE Endpoint Types
# =============================================================================


class DeleteScenarioApiRequest(BaseModel):
    """Request for deleting a scenario."""

    scenario_id: UUID


class DeleteScenarioApiResponse(BaseModel):
    """Response for deleting a scenario."""

    scenario_exists: bool | None = None
    scenario_id: UUID | None = None
    name: str | None = None
    usage_count: int | None = None
    deleted: bool | None = None
    actor_name: str | None = None


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
    """Request for patching a scenario draft."""

    input_draft_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    objectives_enabled_flag_id: UUID | None = None
    images_enabled_flag_id: UUID | None = None
    video_enabled_flag_id: UUID | None = None
    questions_enabled_flag_id: UUID | None = None
    problem_statement_enabled_flag_id: UUID | None = None
    use_templates_flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    template_document_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    objective_ids: list[UUID] | None = None
    problem_statement_id: UUID | None = None
    video_ids: list[UUID] | None = None
    question_ids: list[UUID] | None = None
    expected_version: int | None = 0


class PatchScenarioDraftApiResponse(BaseModel):
    """Response for patching a scenario draft."""

    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


# =============================================================================
# SQL Row Types (for internal use)
# =============================================================================


class ListScenarioSqlScenario(BaseModel):
    """Raw scenario from SQL without computed permissions."""

    scenario_id: UUID | None = None
    title: str | None = None
    problem_statement: str | None = None
    active: bool | None = None
    generated: bool | None = None
    parent_scenario_id: UUID | None = None
    department_ids: list[str] | None = None
    objective_ids: list[str] | None = None
    persona_ids: list[str] | None = None
    parameter_item_ids: list[str] | None = None
    simulation_ids: list[str] | None = None
    num_simulations: int | None = None
    cohort_ids: list[str] | None = None
    updated_at: str | None = None


class ListScenarioSqlRow(BaseModel):
    """Raw SQL row for list scenarios."""

    actor_name: str | None = None
    user_role: str | None = None
    user_department_ids: list[UUID] | None = None
    scenarios: list[ListScenarioSqlScenario] | None = None
    objectives: list[ListScenarioApiObjective] | None = None
    fields: list[ListScenarioApiField] | None = None
    cohorts: list[ListScenarioApiCohort] | None = None
    personas: list[ListScenarioApiPersona] | None = None
    simulations: list[ListScenarioApiSimulation] | None = None
    departments: list[ListScenarioApiDepartment] | None = None
    persona_options: list[ListScenarioApiOption] | None = None
    simulation_options: list[ListScenarioApiOption] | None = None
    department_options: list[ListScenarioApiOption] | None = None
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
    template_document_ids: list[UUID] | None = None
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
    template_search: str | None = None
    image_search: str | None = None
    video_search: str | None = None
    question_search: str | None = None
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
            self.template_document_ids,
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
            self.template_search,
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
    name_agent_id: UUID | None = None
    name_required: bool | None = None
    name_suggestions: list[UUID] | None = None
    names: list[ScenarioNameResource] | None = None
    description_id: UUID | None = None
    description_resource: ScenarioDescriptionResource | None = None
    show_description: bool | None = None
    description_agent_id: UUID | None = None
    description_required: bool | None = None
    description_suggestions: list[UUID] | None = None
    descriptions: list[ScenarioDescriptionResource] | None = None
    problem_statement_id: UUID | None = None
    problem_statement_resource: ScenarioProblemStatement | None = None
    show_problem_statement: bool | None = None
    problem_statement_agent_id: UUID | None = None
    problem_statement_required: bool | None = None
    problem_statement_suggestions: list[UUID] | None = None
    problem_statements: list[ScenarioProblemStatement] | None = None
    active_flag_id: UUID | None = None
    active_flag_resource: ScenarioFlagResource | None = None
    show_active_flag: bool | None = None
    active_flag_agent_id: UUID | None = None
    active_flag_required: bool | None = None
    objectives_enabled_flag_id: UUID | None = None
    objectives_enabled_flag_resource: ScenarioFlagResource | None = None
    show_objectives_enabled_flag: bool | None = None
    objectives_enabled_flag_agent_id: UUID | None = None
    objectives_enabled_flag_required: bool | None = None
    images_enabled_flag_id: UUID | None = None
    images_enabled_flag_resource: ScenarioFlagResource | None = None
    show_images_enabled_flag: bool | None = None
    images_enabled_flag_agent_id: UUID | None = None
    images_enabled_flag_required: bool | None = None
    video_enabled_flag_id: UUID | None = None
    video_enabled_flag_resource: ScenarioFlagResource | None = None
    show_video_enabled_flag: bool | None = None
    video_enabled_flag_agent_id: UUID | None = None
    video_enabled_flag_required: bool | None = None
    questions_enabled_flag_id: UUID | None = None
    questions_enabled_flag_resource: ScenarioFlagResource | None = None
    show_questions_enabled_flag: bool | None = None
    questions_enabled_flag_agent_id: UUID | None = None
    questions_enabled_flag_required: bool | None = None
    problem_statement_enabled_flag_id: UUID | None = None
    problem_statement_enabled_flag_resource: ScenarioFlagResource | None = None
    show_problem_statement_enabled_flag: bool | None = None
    problem_statement_enabled_flag_agent_id: UUID | None = None
    problem_statement_enabled_flag_required: bool | None = None
    use_templates_flag_id: UUID | None = None
    use_templates_flag_resource: ScenarioFlagResource | None = None
    show_use_templates_flag: bool | None = None
    use_templates_flag_agent_id: UUID | None = None
    use_templates_flag_required: bool | None = None
    department_ids: list[UUID] | None = None
    department_resources: list[ScenarioDepartment] | None = None
    show_departments: bool | None = None
    departments_agent_id: UUID | None = None
    departments_required: bool | None = None
    department_suggestions: list[UUID] | None = None
    departments: list[ScenarioDepartment] | None = None
    parameter_field_ids: list[UUID] | None = None
    parameter_field_resources: list[ScenarioField] | None = None
    show_parameter_fields: bool | None = None
    parameter_fields_agent_id: UUID | None = None
    parameter_fields_required: bool | None = None
    parameter_fields: list[ScenarioField] | None = None
    objective_ids: list[UUID] | None = None
    objective_resources: list[ScenarioObjective] | None = None
    show_objectives: bool | None = None
    objectives_agent_id: UUID | None = None
    objectives_required: bool | None = None
    objective_suggestions: list[UUID] | None = None
    objectives: list[ScenarioObjective] | None = None
    image_ids: list[UUID] | None = None
    image_resources: list[ScenarioImage] | None = None
    show_images: bool | None = None
    images_agent_id: UUID | None = None
    images_required: bool | None = None
    image_suggestions: list[UUID] | None = None
    images: list[ScenarioImage] | None = None
    video_ids: list[UUID] | None = None
    video_resources: list[ScenarioVideo] | None = None
    show_videos: bool | None = None
    videos_agent_id: UUID | None = None
    videos_required: bool | None = None
    video_suggestions: list[UUID] | None = None
    videos: list[ScenarioVideo] | None = None
    question_ids: list[UUID] | None = None
    question_resources: list[ScenarioQuestion] | None = None
    show_questions: bool | None = None
    questions_agent_id: UUID | None = None
    questions_required: bool | None = None
    question_suggestions: list[UUID] | None = None
    questions: list[ScenarioQuestion] | None = None
    template_ids: list[UUID] | None = None
    template_resources: list[ScenarioTemplate] | None = None
    show_templates: bool | None = None
    templates_agent_id: UUID | None = None
    templates_required: bool | None = None
    template_suggestions: list[UUID] | None = None
    templates: list[ScenarioTemplate] | None = None
    persona_ids: list[UUID] | None = None
    persona_resources: list[ScenarioPersona] | None = None
    show_personas: bool | None = None
    personas_agent_id: UUID | None = None
    personas_required: bool | None = None
    persona_suggestions: list[UUID] | None = None
    personas: list[ScenarioPersona] | None = None
    document_ids: list[UUID] | None = None
    document_resources: list[ScenarioDocument] | None = None
    show_documents: bool | None = None
    documents_agent_id: UUID | None = None
    documents_required: bool | None = None
    document_suggestions: list[UUID] | None = None
    documents: list[ScenarioDocument] | None = None
    parameter_ids: list[UUID] | None = None
    parameter_resources: list[ScenarioParameter] | None = None
    show_parameters: bool | None = None
    parameters_agent_id: UUID | None = None
    parameters_required: bool | None = None
    parameter_suggestions: list[UUID] | None = None
    parameters: list[ScenarioParameter] | None = None
    basic_agent_id: UUID | None = None
    content_agent_id: UUID | None = None


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
    """SQL parameters for save scenario - accepts form data directly (no draft_id)."""

    # Context
    profile_id: UUID  # Added from header
    group_id: UUID  # REQUIRED - which group to save to
    input_scenario_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None
    problem_statement_id: UUID | None = None
    active_flag_id: UUID | None = None
    objectives_enabled_flag_id: UUID | None = None
    images_enabled_flag_id: UUID | None = None
    video_enabled_flag_id: UUID | None = None
    questions_enabled_flag_id: UUID | None = None
    problem_statement_enabled_flag_id: UUID | None = None
    use_templates_flag_id: UUID | None = None

    # Optional multi-select resources
    department_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    template_document_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    objective_ids: list[UUID] | None = None
    video_ids: list[UUID] | None = None
    question_ids: list[UUID] | None = None

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert to tuple for SQL execution."""
        return (
            self.profile_id,
            self.group_id,
            self.input_scenario_id,
            self.name_id,
            self.description_id,
            self.problem_statement_id,
            self.active_flag_id,
            self.objectives_enabled_flag_id,
            self.images_enabled_flag_id,
            self.video_enabled_flag_id,
            self.questions_enabled_flag_id,
            self.problem_statement_enabled_flag_id,
            self.use_templates_flag_id,
            self.department_ids,
            self.persona_ids,
            self.document_ids,
            self.template_document_ids,
            self.parameter_ids,
            self.field_ids,
            self.image_ids,
            self.objective_ids,
            self.video_ids,
            self.question_ids,
        )


class SaveScenarioSqlRow(BaseModel):
    """SQL row for save scenario."""

    scenario_id: UUID | None = None
    actor_name: str | None = None


class DeleteScenarioSqlParams(BaseModel):
    """SQL parameters for delete scenario."""

    scenario_id: UUID
    profile_id: UUID

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert to tuple for SQL execution."""
        return (
            self.scenario_id,
            self.profile_id,
        )


class DeleteScenarioSqlRow(BaseModel):
    """SQL row for delete scenario."""

    scenario_exists: bool | None = None
    scenario_id: UUID | None = None
    name: str | None = None
    usage_count: int | None = None
    deleted: bool | None = None
    actor_name: str | None = None


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
    """SQL parameters for patch scenario draft."""

    profile_id: UUID
    input_draft_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    active_flag_id: UUID | None = None
    objectives_enabled_flag_id: UUID | None = None
    images_enabled_flag_id: UUID | None = None
    video_enabled_flag_id: UUID | None = None
    questions_enabled_flag_id: UUID | None = None
    problem_statement_enabled_flag_id: UUID | None = None
    use_templates_flag_id: UUID | None = None
    department_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    template_document_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    objective_ids: list[UUID] | None = None
    problem_statement_id: UUID | None = None
    video_ids: list[UUID] | None = None
    question_ids: list[UUID] | None = None
    expected_version: int | None = 0

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert to tuple for SQL execution."""
        return (
            self.profile_id,
            self.input_draft_id,
            self.name_id,
            self.description_id,
            self.active_flag_id,
            self.objectives_enabled_flag_id,
            self.images_enabled_flag_id,
            self.video_enabled_flag_id,
            self.questions_enabled_flag_id,
            self.problem_statement_enabled_flag_id,
            self.use_templates_flag_id,
            self.department_ids,
            self.persona_ids,
            self.document_ids,
            self.template_document_ids,
            self.parameter_ids,
            self.field_ids,
            self.image_ids,
            self.objective_ids,
            self.problem_statement_id,
            self.video_ids,
            self.question_ids,
            self.expected_version,
        )


class PatchScenarioDraftSqlRow(BaseModel):
    """SQL row for patch scenario draft."""

    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None
