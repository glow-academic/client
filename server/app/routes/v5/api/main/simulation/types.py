"""Simulation API types - handcrafted types for simulation endpoints.

These types are used for the simulation API endpoints and include
Python-computed permissions and UI flags.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.routes.v5.api.main.types import InternalResponseBase
from app.routes.v5.api.types import BaseResourceSection, ListFilterSection
from app.routes.v5.tools.entries.runs.search import GetRunListViewResponse

# =============================================================================
# Resource Types (handcrafted — no dependency on app.sql.types)
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


class SimulationScenarioFlag(BaseModel):
    """Scenario flag (denormalized: includes flag name/description/icon)."""

    id: UUID | None = None
    scenario_id: UUID | None = None
    flag_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    icon: str | None = None
    generated: bool | None = None


class SimulationScenarioPosition(BaseModel):
    """Scenario position."""

    id: UUID | None = None
    scenario_id: UUID | None = None
    value: int | None = None
    generated: bool | None = None


class SimulationScenarioRubric(BaseModel):
    """Scenario rubric."""

    id: UUID | None = None
    scenario_id: UUID | None = None
    rubric_id: UUID | None = None
    generated: bool | None = None


class SimulationScenarioTimeLimit(BaseModel):
    """Scenario time limit."""

    id: UUID | None = None
    scenario_id: UUID | None = None
    time_limit_seconds: int | None = None
    generated: bool | None = None
    negative: bool | None = None


class SimulationRubric(BaseModel):
    """Rubric catalog item."""

    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    standard_group_ids: list[UUID] | None = None


class SimulationDraftEntry(BaseModel):
    """Simulation draft entry for websocket."""

    draft_id: UUID | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    version: int | None = None
    generated: bool | None = None
    mcp: bool | None = None
    active: bool | None = None
    group_id: UUID | None = None
    name_ids: list[UUID] | None = None
    description_ids: list[UUID] | None = None
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    scenario_flag_ids: list[UUID] | None = None
    scenario_position_ids: list[UUID] | None = None
    scenario_rubric_ids: list[UUID] | None = None
    scenario_time_limit_ids: list[UUID] | None = None


class SimulationFlagConfig(BaseModel):
    """Enriched flag config for direct client consumption."""

    key: str  # "active" or "practice"
    label: str  # "Active" or "Practice"
    description: str | None = None
    icon_id: str | None = None
    flag_option_id: UUID | None = None
    show: bool = True
    required: bool = False
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


# =============================================================================
# Resource Bucket Types (persona-style)
# =============================================================================


class SimulationResourceBucket(BaseModel):
    """Generic resources bucket with full objects (always plural lists)."""

    names: list[SimulationNameResource] | None = None
    descriptions: list[SimulationDescriptionResource] | None = None
    flags: list[SimulationFlagConfig] | None = None
    departments: list[SimulationDepartment] | None = None
    scenarios: list[SimulationScenario] | None = None
    scenario_flags: list[SimulationScenarioFlag] | None = None
    scenario_positions: list[SimulationScenarioPosition] | None = None
    scenario_rubrics: list[SimulationScenarioRubric] | None = None
    scenario_time_limits: list[SimulationScenarioTimeLimit] | None = None
    rubrics: list[SimulationRubric] | None = None


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
    effective_draft_version: int | None = None


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

    # Candidate agents (for Python-side agent scoring)
    candidate_agents: list[dict] | None = None

    # Tools existence flags
    names_has_tools: bool | None = None
    descriptions_has_tools: bool | None = None
    flags_has_tools: bool | None = None
    departments_has_tools: bool | None = None
    scenarios_has_tools: bool | None = None
    scenario_flags_has_tools: bool | None = None
    scenario_positions_has_tools: bool | None = None
    scenario_rubrics_has_tools: bool | None = None
    scenario_time_limits_has_tools: bool | None = None


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
    # Denormalized resource IDs
    persona_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    objective_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    video_ids: list[UUID] | None = None
    question_ids: list[UUID] | None = None
    option_ids: list[UUID] | None = None
    problem_statement_ids: list[UUID] | None = None


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
    department_ids: list[UUID] | None = None
    suggest_source: str | None = None
    exclude_ids: list[UUID] | None = None
    scenario: bool | None = None
    simulation: bool | None = None


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
    group_id: UUID
    scenario_search: str | None = None
    filter_scenario_ids: list[UUID] | None = None


class SimulationNameSection(BaseResourceSection):
    resource: SimulationNameResource | None = None
    resources: list[SimulationNameResource] | None = None


class SimulationDescriptionSection(BaseResourceSection):
    resource: SimulationDescriptionResource | None = None
    resources: list[SimulationDescriptionResource] | None = None


class SimulationFlagSection(BaseResourceSection):
    current: list[SimulationFlagConfig] | None = None
    resources: list[SimulationFlagConfig] | None = None


class SimulationDepartmentSection(BaseResourceSection):
    current: list[SimulationDepartment] | None = None
    resources: list[SimulationDepartment] | None = None


class SimulationScenarioSection(BaseResourceSection):
    current: list[SimulationScenario] | None = None
    resources: list[SimulationScenario] | None = None


class SimulationScenarioFlagSection(BaseResourceSection):
    current: list[SimulationScenarioFlag] | None = None
    resources: list[SimulationScenarioFlag] | None = None


class SimulationScenarioPositionSection(BaseResourceSection):
    current: list[SimulationScenarioPosition] | None = None
    resources: list[SimulationScenarioPosition] | None = None


class SimulationScenarioRubricSection(BaseResourceSection):
    current: list[SimulationScenarioRubric] | None = None
    resources: list[SimulationScenarioRubric] | None = None


class SimulationScenarioTimeLimitSection(BaseResourceSection):
    current: list[SimulationScenarioTimeLimit] | None = None
    resources: list[SimulationScenarioTimeLimit] | None = None


class GetSimulationApiResponse(BaseModel):
    """Section-first response for simulation editor."""

    actor_name: str | None = None
    simulation_exists: bool | None = None
    can_edit: bool | None = None
    disabled_reason: str | None = None
    draft_version: int | None = None
    group_id: UUID | None = None

    basic_show_ai_generate: bool | None = None

    names: SimulationNameSection | None = None
    descriptions: SimulationDescriptionSection | None = None
    flags: SimulationFlagSection | None = None
    departments: SimulationDepartmentSection | None = None
    scenarios: SimulationScenarioSection | None = None
    scenario_flags: SimulationScenarioFlagSection | None = None
    scenario_positions: SimulationScenarioPositionSection | None = None
    scenario_rubrics: SimulationScenarioRubricSection | None = None
    scenario_time_limits: SimulationScenarioTimeLimitSection | None = None
    rubrics: list[SimulationRubric] | None = None


class SimulationWebsocketEntries(BaseModel):
    """Optional websocket entries payload."""

    draft_simulation: SimulationDraftEntry | None = None
    runs: GetRunListViewResponse | None = None


class SimulationWebsocketResources(BaseModel):
    """Hydrated websocket resources: selected simulation + config resources."""

    names: list[SimulationNameResource] | None = None
    descriptions: list[SimulationDescriptionResource] | None = None
    flags: list[SimulationFlagConfig] | None = None
    departments: list[SimulationDepartment] | None = None
    scenarios: list[SimulationScenario] | None = None
    scenario_flags: list[SimulationScenarioFlag] | None = None
    scenario_positions: list[SimulationScenarioPosition] | None = None
    scenario_rubrics: list[SimulationScenarioRubric] | None = None
    scenario_time_limits: list[SimulationScenarioTimeLimit] | None = None
    rubrics: list[SimulationRubric] | None = None


class GetSimulationWebsocketResponse(InternalResponseBase):
    """Minimal response for simulation websocket generation handlers."""

    entries: SimulationWebsocketEntries | None = None
    resources: SimulationWebsocketResources


# =============================================================================
# LIST Endpoint Types
# =============================================================================


class ListSimulationApiSimulation(BaseModel):
    """Simulation item in list response with Python-computed permissions."""

    simulation_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    is_inactive: bool | None = None
    practice_simulation: bool | None = None
    generated: bool | None = None
    mcp: bool | None = None
    scenario_ids: list[str] | None = None
    num_cohorts: int | None = None
    cohort_usage_count: int | None = None
    can_edit: bool | None = None
    can_delete: bool | None = None
    can_duplicate: bool | None = None
    cohort_ids: list[str] | None = None
    updated_at: datetime | None = None


class ListSimulationApiPersona(BaseModel):
    """Persona in list response (minimal: only for color dot rendering)."""

    persona_id: str | None = None
    color: str | None = None


class ListSimulationApiScenario(BaseModel):
    """Scenario in list response (minimal: only for color dot rendering)."""

    scenario_id: UUID | None = None
    name: str | None = None
    persona_ids: list[str] | None = None
    persona_mapping: list[ListSimulationApiPersona] | None = None


class ListSimulationApiResponse(BaseModel):
    """Response for listing simulations."""

    actor_name: str | None = None
    simulations: list[ListSimulationApiSimulation] | None = None
    scenarios: list[ListSimulationApiScenario] | None = None
    scenario_filter: "ListFilterSection | None" = None
    cohort_filter: "ListFilterSection | None" = None
    department_filter: "ListFilterSection | None" = None
    total_count: int | None = None
    import_fields: list[Any] | None = None


# =============================================================================
# Resource Action Types (for tool call tracking)
# =============================================================================


# =============================================================================
# Shared Save/Create/Update Types
# =============================================================================


class SimulationFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class SimulationResultItem(BaseModel):
    """Per-item result within a bulk create/update response."""

    success: bool
    simulation_id: UUID | None = None
    message: str
    errors: list[SimulationFieldError] | None = None


# =============================================================================
# Create Endpoint Types
# =============================================================================


class CreateSimulationItem(BaseModel):
    """Single simulation item for create — no simulation_id.

    Required fields (name): provide ID or value.
    """

    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    # Multi-select IDs
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    scenario_flag_ids: list[UUID] | None = None
    scenario_position_ids: list[UUID] | None = None
    scenario_rubric_ids: list[UUID] | None = None
    scenario_time_limit_ids: list[UUID] | None = None
    # Value-based fields for CSV import (match-by-name resolution)
    is_inactive: bool | None = None
    is_practice: bool | None = None
    departments: list[str] | None = None
    scenarios: list[str] | None = None


class CreateSimulationApiRequest(BaseModel):
    """Request model for bulk create simulation endpoint."""

    simulations: list[CreateSimulationItem]
    group_id: UUID | None = None


class CreateSimulationApiResponse(BaseModel):
    """Response model for bulk create simulation endpoint."""

    results: list[SimulationResultItem]


# =============================================================================
# Update Endpoint Types
# =============================================================================


class UpdateSimulationItem(BaseModel):
    """Single simulation item for update — simulation_id required, all fields optional.

    Only provided fields are updated (partial update).
    """

    simulation_id: UUID  # Required — which simulation to update
    # Optional single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    description_id: UUID | None = None
    description: str | None = None
    # Multi-select IDs
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    scenario_flag_ids: list[UUID] | None = None
    scenario_position_ids: list[UUID] | None = None
    scenario_rubric_ids: list[UUID] | None = None
    scenario_time_limit_ids: list[UUID] | None = None
    # Value-based fields for CSV import (match-by-name resolution)
    is_inactive: bool | None = None
    is_practice: bool | None = None
    departments: list[str] | None = None
    scenarios: list[str] | None = None


class UpdateSimulationApiRequest(BaseModel):
    """Request model for bulk update simulation endpoint."""

    simulations: list[UpdateSimulationItem]
    group_id: UUID | None = None


class UpdateSimulationApiResponse(BaseModel):
    """Response model for bulk update simulation endpoint."""

    results: list[SimulationResultItem]


# =============================================================================
# Legacy SAVE Endpoint Types (backwards compat)
# =============================================================================


class SaveSimulationFieldError(BaseModel):
    """Per-field error from value resolution."""

    field: str
    message: str


class SaveSimulationItem(BaseModel):
    """Single simulation item for save — provide ID or value per field (not both).

    For required fields (name), exactly one of the *_id or value field must
    be provided.
    """

    input_simulation_id: UUID | None = None
    # Required single-select — provide ID or value
    name_id: UUID | None = None
    name: str | None = None
    # Optional single-select — provide ID or value
    description_id: UUID | None = None
    description: str | None = None
    # Multi-select IDs
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    scenario_flag_ids: list[UUID] | None = None
    scenario_position_ids: list[UUID] | None = None
    scenario_rubric_ids: list[UUID] | None = None
    scenario_time_limit_ids: list[UUID] | None = None
    # Value-based fields for CSV import (match-by-name resolution)
    is_inactive: bool | None = None
    is_practice: bool | None = None
    departments: list[str] | None = None
    scenarios: list[str] | None = None


class SaveSimulationApiRequest(BaseModel):
    """Request model for bulk save simulation endpoint."""

    simulations: list[SaveSimulationItem]
    group_id: UUID | None = None  # Tool tracking context from GET response


class SaveSimulationResult(BaseModel):
    """Per-item result within a bulk save response."""

    success: bool
    simulation_id: UUID | None = None
    message: str
    errors: list[SaveSimulationFieldError] | None = None


class SaveSimulationApiResponse(BaseModel):
    """Response model for bulk save simulation endpoint."""

    results: list[SaveSimulationResult]


class SaveSimulationSqlParams(BaseModel):
    """SQL parameters for save simulation - flat resource IDs."""

    profile_id: UUID
    input_simulation_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    scenario_flag_ids: list[UUID] | None = None
    scenario_position_ids: list[UUID] | None = None
    scenario_rubric_ids: list[UUID] | None = None
    scenario_time_limit_ids: list[UUID] | None = None
    simulations_resource_id: UUID | None = None

    @classmethod
    def from_request(
        cls,
        request: SaveSimulationItem,
        profile_id: UUID,
        simulations_resource_id: UUID | None = None,
    ) -> "SaveSimulationSqlParams":
        return cls(
            profile_id=profile_id,
            input_simulation_id=request.input_simulation_id,
            name_id=request.name_id,
            description_id=request.description_id,
            flag_ids=request.flag_ids,
            department_ids=request.department_ids,
            scenario_ids=request.scenario_ids,
            scenario_flag_ids=request.scenario_flag_ids,
            scenario_position_ids=request.scenario_position_ids,
            scenario_rubric_ids=request.scenario_rubric_ids,
            scenario_time_limit_ids=request.scenario_time_limit_ids,
            simulations_resource_id=simulations_resource_id,
        )

    def to_tuple(self) -> tuple:
        """Convert to tuple for SQL execution.

        Arrays are passed as-is (None preserved) so SQL COALESCE can
        distinguish 'not provided' (NULL) from 'explicitly empty' ([]).
        """
        return (
            self.profile_id,
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
            self.simulations_resource_id,
        )


class SaveSimulationSqlRow(BaseModel):
    """SQL row for save simulation."""

    simulation_id: UUID | None = None


# =============================================================================
# EXPORT Endpoint Types
# =============================================================================


class ExportSimulationApiRequest(BaseModel):
    """Request model for export simulation endpoint."""

    search: str | None = None
    filter_scenario_ids: list[str] | None = None
    filter_cohort_ids: list[str] | None = None
    filter_department_ids: list[str] | None = None


class ExportSimulationApiResponse(BaseModel):
    """Response model for export simulation endpoint."""

    upload_id: UUID
    file_name: str
    row_count: int


# =============================================================================
# DELETE Endpoint Types
# =============================================================================


class DeleteSimulationApiRequest(BaseModel):
    """Request model for bulk delete simulation endpoint."""

    simulation_ids: list[UUID]


class DeleteSimulationResult(BaseModel):
    """Per-item result within a bulk delete response."""

    success: bool
    simulation_id: UUID
    message: str


class DeleteSimulationApiResponse(BaseModel):
    """Response model for bulk delete simulation endpoint."""

    results: list[DeleteSimulationResult]


# =============================================================================
# DUPLICATE Endpoint Types
# =============================================================================


class DuplicateSimulationApiRequest(BaseModel):
    """Request for duplicating a simulation."""

    simulation_id: UUID


class DuplicateSimulationApiResponse(BaseModel):
    """Response for duplicating a simulation."""

    success: bool
    simulation_id: UUID
    message: str


# =============================================================================
# DRAFT Endpoint Types
# =============================================================================


class PatchSimulationDraftApiRequest(BaseModel):
    """Request model for new-style simulation draft endpoint.

    Dual-mode for creatable resources only:
      - name/name_id, description/description_id
    ID-only for non-creatable resources:
      - flag_ids, department_ids, scenario_ids, scenario_flag_ids,
        scenario_position_ids, scenario_rubric_ids, scenario_time_limit_ids

    Client always sends full state (append-only — each write is a new version snapshot).
    """

    group_id: UUID
    input_draft_id: UUID | None = None
    expected_version: int = 0

    # Creatable single-select — provide value or ID
    name: str | None = None
    name_id: UUID | None = None
    description: str | None = None
    description_id: UUID | None = None

    # Non-creatable — ID-only
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    scenario_flag_ids: list[UUID] | None = None
    scenario_position_ids: list[UUID] | None = None
    scenario_rubric_ids: list[UUID] | None = None
    scenario_time_limit_ids: list[UUID] | None = None


class PatchSimulationDraftApiResponse(BaseModel):
    """Response model for new-style simulation draft endpoint."""

    success: bool
    draft_id: UUID
    new_version: int
    message: str


# =============================================================================
# SQL Row Types (for internal use)
# =============================================================================


class ListSimulationSqlSimulation(BaseModel):
    """Raw simulation from SQL — permissions computed in Python."""

    simulation_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    is_inactive: bool | None = None
    practice_simulation: bool | None = None
    scenario_ids: list[str] | None = None
    num_cohorts: int | None = None
    cohort_usage_count: int | None = None
    cohort_ids: list[str] | None = None
    generated: bool | None = None
    mcp: bool | None = None
    updated_at: datetime | None = None


class ListSimulationSqlRow(BaseModel):
    """Raw SQL row for list simulations."""

    actor_name: str | None = None
    simulations: list[ListSimulationSqlSimulation] | None = None
    scenario_options: list[dict] | None = None
    cohort_options: list[dict] | None = None
    department_options: list[dict] | None = None
    total_count: int | None = None
