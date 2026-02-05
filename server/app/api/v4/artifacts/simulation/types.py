"""Simulation API types - handcrafted types for simulation endpoints.

These types are used for the simulation API endpoints and include
Python-computed permissions and UI flags.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

# =============================================================================
# Resource Types (imported from SQL types for reuse)
# =============================================================================


class SimulationNameResource(BaseModel):
    """Name resource for simulation."""

    id: UUID | None = None
    name: str | None = None
    generated: bool | None = None


class SimulationDescriptionResource(BaseModel):
    """Description resource for simulation."""

    id: UUID | None = None
    description: str | None = None
    generated: bool | None = None


class SimulationFlagResource(BaseModel):
    """Flag resource for simulation."""

    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    icon_id: UUID | None = None
    generated: bool | None = None


class SimulationFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str  # "active" or "practice"
    label: str  # "Active" or "Practice"
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    agent_id: UUID | None = None
    generated: bool | None = None


class SimulationDepartment(BaseModel):
    """Department for simulation."""

    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None


class SimulationScenario(BaseModel):
    """Scenario for simulation."""

    scenario_id: UUID | None = None
    name: str | None = None  # Changed from title to match SQL
    description: str | None = None
    generated: bool | None = None
    # Computed show_* flags (business logic in Python)
    show_problem_statement: bool | None = None
    show_objectives: bool | None = None
    show_video: bool | None = None
    show_text: bool | None = None
    show_audio: bool | None = None
    show_copy_paste: bool | None = None
    show_images: bool | None = None
    show_questions: bool | None = None
    show_templates: bool | None = None


class SimulationScenarioPosition(BaseModel):
    """Scenario position for simulation."""

    id: UUID | None = None
    simulation_id: UUID | None = None
    scenario_id: UUID | None = None
    value: int | None = None
    generated: bool | None = None


class SimulationScenarioFlag(BaseModel):
    """Scenario flag for simulation."""

    id: UUID | None = None
    scenario_id: UUID | None = None
    flag_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    generated: bool | None = None


class SimulationScenarioRubric(BaseModel):
    """Scenario rubric for simulation."""

    id: UUID | None = None
    scenario_id: UUID | None = None
    rubric_id: UUID | None = None
    generated: bool | None = None


class SimulationScenarioPersona(BaseModel):
    """Scenario persona for simulation."""

    id: UUID | None = None
    simulation_id: UUID | None = None
    scenario_id: UUID | None = None
    persona_id: UUID | None = None
    persona_name: str | None = None
    persona_description: str | None = None
    persona_icon: str | None = None
    persona_color: str | None = None
    generated: bool | None = None


class SimulationScenarioTimeLimit(BaseModel):
    """Scenario time limit for simulation."""

    id: UUID | None = None
    scenario_id: UUID | None = None
    time_limit_seconds: int | None = None
    generated: bool | None = None


class SimulationRubric(BaseModel):
    """Rubric for simulation."""

    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None


# =============================================================================
# Access Check Types (Query 1)
# =============================================================================


class GetSimulationAccessSqlParams(BaseModel):
    """Parameters for simulation access check query."""

    profile_id: UUID
    simulation_id: UUID | None = None
    draft_id: UUID | None = None

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.profile_id, self.simulation_id, self.draft_id)


class GetSimulationAccessSqlRow(BaseModel):
    """Row returned from simulation access check query."""

    actor_name: str | None = None
    simulation_exists: bool | None = None
    draft_version: int | None = None
    group_id: UUID | None = None
    user_role: str | None = None
    user_department_ids: list[UUID] | None = None
    simulation_department_ids: list[UUID] | None = None
    cohort_usage_count: int | None = None


# =============================================================================
# ID Fetching Types (Query 2)
# =============================================================================


class GetSimulationIdsSqlParams(BaseModel):
    """Parameters for simulation ID fetching query."""

    profile_id: UUID
    simulation_id: UUID | None = None
    draft_id: UUID | None = None
    group_id: UUID | None = None
    user_department_ids: list[UUID] | None = Field(default_factory=list)

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.profile_id,
            self.simulation_id,
            self.draft_id,
            self.group_id,
            self.user_department_ids,
        )


class GetSimulationIdsSqlRow(BaseModel):
    """Row returned from simulation ID fetching query."""

    # Single-select IDs
    name_id: UUID | None = None
    description_id: UUID | None = None

    # Multi-select IDs
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    scenario_flag_ids: list[UUID] | None = None
    scenario_position_ids: list[UUID] | None = None
    scenario_rubric_ids: list[UUID] | None = None
    scenario_time_limit_ids: list[UUID] | None = None
    scenario_persona_ids: list[UUID] | None = None

    # Agent IDs
    name_agent_id: UUID | None = None
    description_agent_id: UUID | None = None
    flag_agent_id: UUID | None = None
    departments_agent_id: UUID | None = None
    scenarios_agent_id: UUID | None = None
    basic_agent_id: UUID | None = None
    general_agent_id: UUID | None = None

    # Candidate agents (for Python-side agent scoring)
    candidate_agents: list[dict] | None = None

    # Tools existence flags
    names_has_tools: bool | None = None
    descriptions_has_tools: bool | None = None
    flags_has_tools: bool | None = None
    departments_has_tools: bool | None = None
    scenarios_has_tools: bool | None = None


# =============================================================================
# Scenarios Resource Types
# =============================================================================


class QGetScenariosV4Item(BaseModel):
    """Scenario item from scenarios resource query."""

    scenario_id: UUID | None = None
    name: str | None = None  # Changed from title to match SQL
    description: str | None = None
    generated: bool | None = None
    # Raw _enabled flags from SQL (business logic computed in Python)
    problem_statement_enabled: bool | None = None
    objectives_enabled: bool | None = None
    video_enabled: bool | None = None
    images_enabled: bool | None = None
    questions_enabled: bool | None = None
    templates_enabled: bool | None = None


class GetScenariosSqlParams(BaseModel):
    """Parameters for getting scenarios by IDs."""

    ids: list[UUID]

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.ids,)


class GetScenariosSqlRow(BaseModel):
    """Row returned from scenarios get query."""

    items: list[QGetScenariosV4Item] | None = None


class SearchScenariosSqlParams(BaseModel):
    """Parameters for searching scenarios."""

    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    user_department_ids: list[UUID] | None = None
    suggest_source: str | None = None
    exclude_ids: list[UUID] | None = None

    def to_tuple(self) -> tuple[Any, ...]:
        return (
            self.search,
            self.limit_count,
            self.offset_count,
            self.user_department_ids,
            self.suggest_source,
            self.exclude_ids,
        )


class SearchScenariosSqlRow(BaseModel):
    """Row returned from scenarios search query."""

    items: list[QGetScenariosV4Item] | None = None


# API Request/Response types for scenarios resource
class GetScenariosApiRequest(BaseModel):
    """Request for getting scenarios by IDs."""

    ids: list[UUID]


class GetScenariosApiResponse(BaseModel):
    """Response for getting scenarios by IDs."""

    items: list[QGetScenariosV4Item] | None = None


class SearchScenariosApiRequest(BaseModel):
    """Request for searching scenarios."""

    search: str | None = None
    limit_count: int | None = 20
    offset_count: int | None = 0
    user_department_ids: list[UUID] | None = None
    suggest_source: str | None = None
    exclude_ids: list[UUID] | None = None


class SearchScenariosApiResponse(BaseModel):
    """Response for searching scenarios."""

    items: list[QGetScenariosV4Item] | None = None


# =============================================================================
# GET Endpoint Types
# =============================================================================


class GetSimulationApiRequest(BaseModel):
    """Request for getting a single simulation."""

    simulation_id: UUID | None = None
    draft_id: UUID | None = None
    scenario_search: str | None = None
    scenario_show_selected: bool | None = None
    filter_scenario_ids: list[UUID] | None = None


class GetSimulationApiResponse(BaseModel):
    """Response for getting a single simulation."""

    # Required metadata fields
    actor_name: str | None = None
    simulation_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    # Name resource
    name_id: UUID | None = None
    name_resource: SimulationNameResource | None = None
    show_name: bool | None = None
    name_agent_id: UUID | None = None
    name_required: bool | None = None
    name_suggestions: list[UUID] | None = None
    names: list[SimulationNameResource] | None = None

    # Description resource
    description_id: UUID | None = None
    description_resource: SimulationDescriptionResource | None = None
    show_description: bool | None = None
    description_agent_id: UUID | None = None
    description_required: bool | None = None
    description_suggestions: list[UUID] | None = None
    descriptions: list[SimulationDescriptionResource] | None = None

    # Flag resources (multi-select like departments)
    flag_ids: list[UUID] | None = None
    flag_resources: list[SimulationFlagResource] | None = None
    show_flags: bool | None = None
    flag_agent_id: UUID | None = None
    flag_required: bool | None = None
    flags: list[SimulationFlagConfig] | None = None

    # Departments
    department_ids: list[UUID] | None = None
    department_resources: list[SimulationDepartment] | None = None
    show_departments: bool | None = None
    departments_agent_id: UUID | None = None
    departments_required: bool | None = None
    department_suggestions: list[UUID] | None = None
    departments: list[SimulationDepartment] | None = None

    # Scenarios
    scenario_ids: list[UUID] | None = None
    scenario_resources: list[SimulationScenario] | None = None
    show_scenarios: bool | None = None
    scenarios_agent_id: UUID | None = None
    scenarios_required: bool | None = None
    scenario_suggestions: list[UUID] | None = None
    scenarios: list[SimulationScenario] | None = None

    # Scenario flags
    scenario_flag_ids: list[UUID] | None = None
    scenario_flag_resources: list[SimulationScenarioFlag] | None = None
    show_scenario_flags: bool | None = None
    scenario_flags_agent_id: UUID | None = None
    scenario_flags_required: bool | None = None
    scenario_flag_suggestions: list[UUID] | None = None
    scenario_flags: list[SimulationScenarioFlag] | None = None

    # Scenario positions
    scenario_position_ids: list[UUID] | None = None
    scenario_position_resources: list[SimulationScenarioPosition] | None = None
    show_scenario_positions: bool | None = None
    scenario_positions_agent_id: UUID | None = None
    scenario_positions_required: bool | None = None
    scenario_position_suggestions: list[UUID] | None = None
    scenario_positions: list[SimulationScenarioPosition] | None = None

    # Scenario rubrics
    scenario_rubric_ids: list[UUID] | None = None
    scenario_rubric_resources: list[SimulationScenarioRubric] | None = None
    show_scenario_rubrics: bool | None = None
    scenario_rubrics_agent_id: UUID | None = None
    scenario_rubrics_required: bool | None = None
    scenario_rubric_suggestions: list[UUID] | None = None
    scenario_rubrics: list[SimulationScenarioRubric] | None = None
    rubrics: list[SimulationRubric] | None = None

    # Scenario time limits
    scenario_time_limit_ids: list[UUID] | None = None
    scenario_time_limit_resources: list[SimulationScenarioTimeLimit] | None = None
    show_scenario_time_limits: bool | None = None
    scenario_time_limits_agent_id: UUID | None = None
    scenario_time_limits_required: bool | None = None
    scenario_time_limit_suggestions: list[UUID] | None = None
    scenario_time_limits: list[SimulationScenarioTimeLimit] | None = None

    # Scenario personas
    scenario_persona_ids: list[UUID] | None = None
    scenario_persona_resources: list[SimulationScenarioPersona] | None = None
    show_scenario_personas: bool | None = None
    scenario_personas_agent_id: UUID | None = None
    scenario_personas_required: bool | None = None
    scenario_persona_suggestions: list[UUID] | None = None
    scenario_personas: list[SimulationScenarioPersona] | None = None

    # Multi-resource combination agent IDs
    basic_agent_id: UUID | None = None
    general_agent_id: UUID | None = None


# =============================================================================
# LIST Endpoint Types
# =============================================================================


class ListSimulationApiSimulation(BaseModel):
    """Simulation item in list response with Python-computed permissions."""

    simulation_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    department_ids: list[str] | None = None
    scenario_ids: list[str] | None = None
    usage_count: int | None = None
    updated_at: datetime | None = None

    # Python-computed permissions
    can_edit: bool | None = None
    can_delete: bool | None = None
    can_duplicate: bool | None = None


class ListSimulationApiScenario(BaseModel):
    """Scenario in list response."""

    scenario_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    persona_ids: list[str] | None = None


class ListSimulationApiDepartment(BaseModel):
    """Department in list response."""

    department_id: UUID | None = None
    name: str | None = None
    description: str | None = None


class ListSimulationApiResponse(BaseModel):
    """Response for listing simulations."""

    actor_name: str | None = None
    user_role: str | None = None
    simulations: list[ListSimulationApiSimulation] | None = None
    scenarios: list[ListSimulationApiScenario] | None = None
    departments: list[ListSimulationApiDepartment] | None = None


# =============================================================================
# SAVE Endpoint Types
# =============================================================================


class SaveSimulationApiRequest(BaseModel):
    """Request for saving a simulation - accepts form data directly (no draft_id)."""

    # Context
    group_id: UUID  # REQUIRED - which group to save to
    input_simulation_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None

    # Optional multi-select resources
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    scenario_flag_ids: list[UUID] | None = None
    scenario_position_ids: list[UUID] | None = None
    scenario_rubric_ids: list[UUID] | None = None
    scenario_time_limit_ids: list[UUID] | None = None
    scenario_persona_ids: list[UUID] | None = None


class SaveSimulationApiResponse(BaseModel):
    """Response for saving a simulation."""

    simulation_id: UUID | None = None
    actor_name: str | None = None


class SaveSimulationSqlParams(BaseModel):
    """SQL parameters for save simulation - accepts form data directly (no draft_id)."""

    # Context
    profile_id: UUID  # Added from header
    group_id: UUID  # REQUIRED - which group to save to
    input_simulation_id: UUID | None = None  # For update mode

    # Required single-select resources
    name_id: UUID  # REQUIRED

    # Optional single-select resources
    description_id: UUID | None = None

    # Optional multi-select resources
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    scenario_flag_ids: list[UUID] | None = None
    scenario_position_ids: list[UUID] | None = None
    scenario_rubric_ids: list[UUID] | None = None
    scenario_time_limit_ids: list[UUID] | None = None
    scenario_persona_ids: list[UUID] | None = None

    def to_tuple(self) -> tuple[Any, ...]:
        """Convert to tuple for SQL execution."""
        return (
            self.profile_id,
            self.group_id,
            self.input_simulation_id,
            self.name_id,
            self.description_id,
            self.flag_ids,
            self.department_ids,
            self.scenario_ids,
            self.scenario_flag_ids,
            self.scenario_position_ids,
            self.scenario_rubric_ids,
            self.scenario_time_limit_ids,
            self.scenario_persona_ids,
        )


class SaveSimulationSqlRow(BaseModel):
    """SQL row for save simulation."""

    simulation_id: UUID | None = None
    actor_name: str | None = None


# =============================================================================
# DELETE Endpoint Types
# =============================================================================


class DeleteSimulationApiRequest(BaseModel):
    """Request for deleting a simulation."""

    simulation_id: UUID


class DeleteSimulationApiResponse(BaseModel):
    """Response for deleting a simulation."""

    usage_count: int | None = None
    deleted: bool | None = None
    title: str | None = None
    actor_name: str | None = None


# =============================================================================
# DUPLICATE Endpoint Types
# =============================================================================


class DuplicateSimulationApiRequest(BaseModel):
    """Request for duplicating a simulation."""

    simulation_id: UUID


class DuplicateSimulationApiResponse(BaseModel):
    """Response for duplicating a simulation."""

    simulation_id: UUID | None = None
    simulation_name: str | None = None
    actor_name: str | None = None


# =============================================================================
# DRAFT Endpoint Types
# =============================================================================


class PatchSimulationDraftApiRequest(BaseModel):
    """Request for patching a simulation draft."""

    input_draft_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    scenario_flag_ids: list[UUID] | None = None
    scenario_position_ids: list[UUID] | None = None
    scenario_rubric_ids: list[UUID] | None = None
    scenario_time_limit_ids: list[UUID] | None = None
    scenario_persona_ids: list[UUID] | None = None
    expected_version: int | None = 0


class PatchSimulationDraftApiResponse(BaseModel):
    """Response for patching a simulation draft."""

    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


# =============================================================================
# SQL Row Types (for internal use)
# =============================================================================


class ListSimulationSqlSimulation(BaseModel):
    """Raw simulation from SQL without computed permissions."""

    simulation_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    active: bool | None = None
    department_ids: list[str] | None = None
    scenario_ids: list[str] | None = None
    usage_count: int | None = None
    updated_at: datetime | None = None


class ListSimulationSqlRow(BaseModel):
    """Raw SQL row for list simulations."""

    actor_name: str | None = None
    user_role: str | None = None
    user_department_ids: list[UUID] | None = None
    simulations: list[ListSimulationSqlSimulation] | None = None
    scenarios: list[ListSimulationApiScenario] | None = None
    departments: list[ListSimulationApiDepartment] | None = None
