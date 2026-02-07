"""Simulation API types - handcrafted types for simulation endpoints.

These types are used for the simulation API endpoints and include
Python-computed permissions and UI flags.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.types import DomainAgent, DomainData
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetNamesV4Item,
)

# Re-export for backwards compatibility
__all__ = ["DomainAgent", "DomainData"]

# =============================================================================
# Resource Types (imported from SQL types for reuse)
# =============================================================================


class SimulationFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str  # "active" or "practice"
    label: str  # "Active" or "Practice"
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
    domain_id: UUID | None = None  # Domain ID for generation
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
    name: str | None = None
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


# =============================================================================
# Resource Bucket Types (persona-style)
# =============================================================================


class SimulationResourceBucket(BaseModel):
    """Generic resources bucket with full objects (always plural lists)."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[SimulationFlagConfig] | None = None
    departments: list[QGetDepartmentsV4Item] | None = None
    scenarios: list[SimulationScenario] | None = None
    scenario_flags: list[Any] | None = None
    scenario_personas: list[Any] | None = None
    scenario_positions: list[Any] | None = None
    scenario_rubrics: list[Any] | None = None
    scenario_time_limits: list[Any] | None = None
    rubrics: list[Any] | None = None


class SimulationResources(BaseModel):
    """Full resources + current selections."""

    resources: SimulationResourceBucket | None = None
    current: SimulationResourceBucket | None = None


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

    # Candidate agents (for Python-side agent scoring)
    candidate_agents: list[dict] | None = None

    # Tools existence flags
    names_has_tools: bool | None = None
    descriptions_has_tools: bool | None = None
    flags_has_tools: bool | None = None
    departments_has_tools: bool | None = None
    scenarios_has_tools: bool | None = None
    scenario_flags_has_tools: bool | None = None
    scenario_personas_has_tools: bool | None = None
    scenario_positions_has_tools: bool | None = None
    scenario_rubrics_has_tools: bool | None = None
    scenario_time_limits_has_tools: bool | None = None

    # Domain IDs
    name_domain_id: UUID | None = None
    description_domain_id: UUID | None = None
    flag_domain_id: UUID | None = None
    departments_domain_id: UUID | None = None
    scenarios_domain_id: UUID | None = None
    scenario_flags_domain_id: UUID | None = None
    scenario_personas_domain_id: UUID | None = None
    scenario_positions_domain_id: UUID | None = None
    scenario_rubrics_domain_id: UUID | None = None
    scenario_time_limits_domain_id: UUID | None = None


# =============================================================================
# Scenarios Resource Types
# =============================================================================


class QGetScenariosV4Item(BaseModel):
    """Scenario item from scenarios resource query."""

    scenario_id: UUID | None = None
    name: str | None = None
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
# GET Endpoint Types (persona-style)
# =============================================================================


class GetSimulationApiRequest(BaseModel):
    """Request for getting a single simulation."""

    simulation_id: UUID | None = None
    draft_id: UUID | None = None
    scenario_search: str | None = None
    scenario_show_selected: bool | None = None
    filter_scenario_ids: list[UUID] | None = None


class GetSimulationApiResponse(BaseModel):
    """Response for getting a single simulation (persona-style)."""

    # Required metadata fields
    actor_name: str | None = None
    simulation_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None

    # Group ID
    group_id: UUID | None = None

    # Per-resource group IDs (from draft MV)
    names_group_id: UUID | None = None
    descriptions_group_id: UUID | None = None
    flags_group_id: UUID | None = None
    departments_group_id: UUID | None = None
    scenarios_group_id: UUID | None = None
    scenario_flags_group_id: UUID | None = None
    scenario_personas_group_id: UUID | None = None
    scenario_positions_group_id: UUID | None = None
    scenario_rubrics_group_id: UUID | None = None
    scenario_time_limits_group_id: UUID | None = None

    # Name
    show_name: bool | None = None
    name_domain_id: UUID | None = None
    name_required: bool | None = None
    name_suggestions: list[UUID] | None = None
    name_show_ai_generate: bool | None = None

    # Description
    show_description: bool | None = None
    description_domain_id: UUID | None = None
    description_required: bool | None = None
    description_suggestions: list[UUID] | None = None
    description_show_ai_generate: bool | None = None

    # Flag
    show_flag: bool | None = None
    flag_domain_id: UUID | None = None
    flag_required: bool | None = None
    flag_show_ai_generate: bool | None = None

    # Departments
    show_departments: bool | None = None
    departments_domain_id: UUID | None = None
    departments_required: bool | None = None
    department_suggestions: list[UUID] | None = None
    departments_show_ai_generate: bool | None = None

    # Scenarios
    show_scenarios: bool | None = None
    scenarios_domain_id: UUID | None = None
    scenarios_required: bool | None = None
    scenario_suggestions: list[UUID] | None = None
    scenarios_show_ai_generate: bool | None = None

    # Scenario flags
    show_scenario_flags: bool | None = None
    scenario_flags_domain_id: UUID | None = None
    scenario_flags_required: bool | None = None
    scenario_flags_show_ai_generate: bool | None = None

    # Scenario personas
    show_scenario_personas: bool | None = None
    scenario_personas_domain_id: UUID | None = None
    scenario_personas_required: bool | None = None
    scenario_personas_show_ai_generate: bool | None = None

    # Scenario positions
    show_scenario_positions: bool | None = None
    scenario_positions_domain_id: UUID | None = None
    scenario_positions_required: bool | None = None
    scenario_positions_show_ai_generate: bool | None = None

    # Scenario rubrics
    show_scenario_rubrics: bool | None = None
    scenario_rubrics_domain_id: UUID | None = None
    scenario_rubrics_required: bool | None = None
    scenario_rubrics_show_ai_generate: bool | None = None

    # Scenario time limits
    show_scenario_time_limits: bool | None = None
    scenario_time_limits_domain_id: UUID | None = None
    scenario_time_limits_required: bool | None = None
    scenario_time_limits_show_ai_generate: bool | None = None

    # Step-level AI generation flags
    basic_show_ai_generate: bool | None = None

    # Per-resource CREATE tool IDs
    name_create_tool_id: UUID | None = None
    description_create_tool_id: UUID | None = None
    scenarios_create_tool_id: UUID | None = None

    # Per-resource LINK tool IDs
    name_link_tool_id: UUID | None = None
    description_link_tool_id: UUID | None = None
    flag_link_tool_id: UUID | None = None
    departments_link_tool_id: UUID | None = None
    scenarios_link_tool_id: UUID | None = None
    scenario_flags_link_tool_id: UUID | None = None
    scenario_personas_link_tool_id: UUID | None = None
    scenario_positions_link_tool_id: UUID | None = None
    scenario_rubrics_link_tool_id: UUID | None = None
    scenario_time_limits_link_tool_id: UUID | None = None

    # Rich domain metadata for client display in modals
    domain_data: list[DomainData] | None = None

    # Generic resources payload (full objects + current selections)
    resources: SimulationResources | None = None


class GetSimulationWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers (get_simulation_websocket).

    Contains only what's needed for AI generation:
    - Domain IDs (for domain_to_resource mapping)
    - Domains list (for agent_id lookup)
    - Group ID (for existing group context)
    - Resources (for Jinja template context)
    """

    group_id: UUID | None = None

    # Domain IDs for domain_to_resource mapping
    name_domain_id: UUID | None = None
    description_domain_id: UUID | None = None
    flag_domain_id: UUID | None = None
    departments_domain_id: UUID | None = None
    scenarios_domain_id: UUID | None = None
    scenario_flags_domain_id: UUID | None = None
    scenario_personas_domain_id: UUID | None = None
    scenario_positions_domain_id: UUID | None = None
    scenario_rubrics_domain_id: UUID | None = None
    scenario_time_limits_domain_id: UUID | None = None

    # Domains mapping (domain_id -> agent_id) for server-side agent lookup
    domains: list[DomainAgent] | None = None

    # Resources for Jinja template context
    resources: SimulationResources | None = None


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
