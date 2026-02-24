"""Simulation API types - handcrafted types for simulation endpoints.

These types are used for the simulation API endpoints and include
Python-computed permissions and UI flags.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.artifacts.types import WebsocketArtifacts
from app.api.v4.entries.runs.search import GetRunListViewResponse
from app.api.v4.types import BaseResourceSection, ListFilterSection
from app.sql.types import (
    QGetDepartmentsV4Item,
    QGetDescriptionsV4Item,
    QGetNamesV4Item,
    QGetRubricsV4Item,
    QGetScenarioFlagsV4Item,
    QGetScenarioPositionsV4Item,
    QGetScenarioRubricsV4Item,
    QGetScenarioTimeLimitsV4Item,
    QGetSimulationDraftsEntriesV4Item,
)

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

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[SimulationFlagConfig] | None = None
    departments: list[SimulationDepartment] | None = None
    scenarios: list[SimulationScenario] | None = None
    scenario_flags: list[QGetScenarioFlagsV4Item] | None = None
    scenario_positions: list[QGetScenarioPositionsV4Item] | None = None
    scenario_rubrics: list[QGetScenarioRubricsV4Item] | None = None
    scenario_time_limits: list[QGetScenarioTimeLimitsV4Item] | None = None
    rubrics: list[QGetRubricsV4Item] | None = None


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
    # Denormalized persona_ids for list hydration
    persona_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None


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
    filter_scenario_ids: list[UUID] | None = None


class SimulationNameSection(BaseResourceSection):
    resource: QGetNamesV4Item | None = None
    resources: list[QGetNamesV4Item] | None = None


class SimulationDescriptionSection(BaseResourceSection):
    resource: QGetDescriptionsV4Item | None = None
    resources: list[QGetDescriptionsV4Item] | None = None


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
    current: list[QGetScenarioFlagsV4Item] | None = None
    resources: list[QGetScenarioFlagsV4Item] | None = None


class SimulationScenarioPositionSection(BaseResourceSection):
    current: list[QGetScenarioPositionsV4Item] | None = None
    resources: list[QGetScenarioPositionsV4Item] | None = None


class SimulationScenarioRubricSection(BaseResourceSection):
    current: list[QGetScenarioRubricsV4Item] | None = None
    resources: list[QGetScenarioRubricsV4Item] | None = None


class SimulationScenarioTimeLimitSection(BaseResourceSection):
    current: list[QGetScenarioTimeLimitsV4Item] | None = None
    resources: list[QGetScenarioTimeLimitsV4Item] | None = None


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
    rubrics: list[QGetRubricsV4Item] | None = None


class SimulationWebsocketEntries(BaseModel):
    """Optional websocket entries payload."""

    draft_simulation: QGetSimulationDraftsEntriesV4Item | None = None
    runs: GetRunListViewResponse | None = None


class SimulationWebsocketResources(BaseModel):
    """Hydrated websocket resources: selected simulation + config resources."""

    names: list[QGetNamesV4Item] | None = None
    descriptions: list[QGetDescriptionsV4Item] | None = None
    flags: list[SimulationFlagConfig] | None = None
    departments: list[SimulationDepartment | QGetDepartmentsV4Item] | None = None
    scenarios: list[SimulationScenario] | None = None
    scenario_flags: list[QGetScenarioFlagsV4Item] | None = None
    scenario_positions: list[QGetScenarioPositionsV4Item] | None = None
    scenario_rubrics: list[QGetScenarioRubricsV4Item] | None = None
    scenario_time_limits: list[QGetScenarioTimeLimitsV4Item] | None = None
    rubrics: list[QGetRubricsV4Item] | None = None


class GetSimulationWebsocketResponse(BaseModel):
    """Minimal response for simulation websocket generation handlers."""

    group_id: UUID | None = None
    entries: SimulationWebsocketEntries | None = None
    resource_agent_ids: dict[str, UUID | None] | None = None
    resources: SimulationWebsocketResources
    artifacts: WebsocketArtifacts | None = None


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


# =============================================================================
# Resource Action Types (for tool call tracking)
# =============================================================================


class SimulationResourceAction(BaseModel):
    """Single-select resource action with tool call tracking."""

    resource_id: UUID | None = None
    tool_id: UUID | None = None


class SimulationMultiResourceAction(BaseModel):
    """Multi-select resource action with tool call tracking."""

    resource_ids: list[UUID] | None = None
    tool_id: UUID | None = None


# =============================================================================
# SAVE Endpoint Types
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


class SaveSimulationApiRequest(BaseModel):
    """Request model for bulk save simulation endpoint."""

    simulations: list[SaveSimulationItem]


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

    simulation_id: UUID | None = None
    simulation_name: str | None = None
    actor_name: str | None = None


# =============================================================================
# DRAFT Endpoint Types
# =============================================================================


class PatchSimulationDraftApiRequest(BaseModel):
    """Request for patching a simulation draft - flat resource IDs."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    name_id: UUID | None = None
    description_id: UUID | None = None
    flag_ids: list[UUID] | None = None
    department_ids: list[UUID] | None = None
    scenario_ids: list[UUID] | None = None
    scenario_flag_ids: list[UUID] | None = None
    scenario_position_ids: list[UUID] | None = None
    scenario_rubric_ids: list[UUID] | None = None
    scenario_time_limit_ids: list[UUID] | None = None
    expected_version: int | None = 0


class PatchSimulationDraftApiResponse(BaseModel):
    """Response for patching a simulation draft."""

    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


class PatchSimulationDraftSqlParams(BaseModel):
    """SQL parameters for patch simulation draft."""

    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    names: SimulationResourceAction | None = None
    descriptions: SimulationResourceAction | None = None
    flags: SimulationMultiResourceAction | None = None
    departments: SimulationMultiResourceAction | None = None
    scenarios: SimulationMultiResourceAction | None = None
    scenario_flags: SimulationMultiResourceAction | None = None
    scenario_positions: SimulationMultiResourceAction | None = None
    scenario_rubrics: SimulationMultiResourceAction | None = None
    scenario_time_limits: SimulationMultiResourceAction | None = None
    expected_version: int | None = 0

    @classmethod
    def from_request(
        cls, request: PatchSimulationDraftApiRequest, profile_id: UUID
    ) -> "PatchSimulationDraftSqlParams":
        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            names=SimulationResourceAction(resource_id=request.name_id),
            descriptions=SimulationResourceAction(resource_id=request.description_id),
            flags=SimulationMultiResourceAction(resource_ids=request.flag_ids),
            departments=SimulationMultiResourceAction(
                resource_ids=request.department_ids
            ),
            scenarios=SimulationMultiResourceAction(resource_ids=request.scenario_ids),
            scenario_flags=SimulationMultiResourceAction(
                resource_ids=request.scenario_flag_ids
            ),
            scenario_positions=SimulationMultiResourceAction(
                resource_ids=request.scenario_position_ids
            ),
            scenario_rubrics=SimulationMultiResourceAction(
                resource_ids=request.scenario_rubric_ids
            ),
            scenario_time_limits=SimulationMultiResourceAction(
                resource_ids=request.scenario_time_limit_ids
            ),
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple[Any, ...]:
        def single(
            a: SimulationResourceAction | None,
        ) -> tuple[UUID | None, UUID | None, UUID | None]:
            return (a.resource_id, a.tool_id, a.tool_id) if a else (None, None, None)

        def multi(
            a: SimulationMultiResourceAction | None,
        ) -> tuple[list[UUID] | None, UUID | None, UUID | None]:
            return (a.resource_ids, a.tool_id, a.tool_id) if a else (None, None, None)

        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            single(self.names),
            single(self.descriptions),
            multi(self.flags),
            multi(self.departments),
            multi(self.scenarios),
            multi(self.scenario_flags),
            multi(self.scenario_positions),
            multi(self.scenario_rubrics),
            multi(self.scenario_time_limits),
            self.expected_version,
        )


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
