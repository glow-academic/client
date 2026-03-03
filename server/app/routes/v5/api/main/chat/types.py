"""Custom types for unified chat endpoints.

These types define the client-facing API contract for both home and practice
modes via a single `practice: bool` parameter. Internal parameters (mode,
accessible_cohort_ids) are NOT included here - they are injected by Python.

Architecture:
- list.py (ANALYTICAL): Simulation cards + attempt history + filter options
- get.py (OPERATIONAL): Simulations user can take + scenario_ids + rubric data
- bundle.py (BUNDLE): Section-first customization before starting chat
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.routes.v5.api.main.types import InternalResponseBase
from app.routes.v5.api.entries.runs.search import GetRunListViewResponse
from app.sql.types import (
    QGetAgentsV4Item,
    QGetDepartmentsV4Item,
    QGetDocumentsV4Item,
    QGetImagesV4Item,
    QGetModelsV4Item,
    QGetObjectivesV4Item,
    QGetOptionsV4Item,
    QGetParameterFieldsV4Item,
    QGetParametersV4Item,
    QGetPersonasV4Item,
    QGetProblemStatementsV4Item,
    QGetProvidersV4Item,
    QGetQuestionsV4Item,
    QGetScenariosV4Item,
    QGetToolsV4Item,
    QGetTrainingDraftsEntriesV4Item,
    QGetVideosV4Item,
)

# =============================================================================
# Shared types
# =============================================================================


class RubricMapping(BaseModel):
    """Rubric metadata mapping rubric to its standard groups."""

    rubric_id: UUID
    name: str | None = None
    standard_group_ids: list[str] | None = None


class StandardGroupMapping(BaseModel):
    """Standard group metadata for sidebar/legend."""

    standard_group_id: UUID
    name: str | None = None
    description: str | None = None
    points: int | None = None
    pass_points: int | None = None


class StandardMapping(BaseModel):
    """Standard metadata for sidebar/legend."""

    standard_id: UUID
    standard_group_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    points: int | None = None


class FilterOption(BaseModel):
    """Filter option for dropdowns."""

    value: str
    label: str | None = None
    count: int | None = None


# =============================================================================
# LIST endpoint types (ANALYTICAL) - Simulation cards + attempt history
# =============================================================================


class GetChatListRequest(BaseModel):
    """Client API request for chat list (analytical).

    Returns simulation cards with stats AND paginated attempt history.

    Args:
        practice: If True, returns practice data. If False, returns home data.
        start_date: Start date filter (required).
        end_date: End date filter (required).
        cohort_ids: Filter by cohorts.
        department_ids: Filter by departments.
        simulation_ids: Filter by simulations.
        scenario_ids: Filter by scenarios.
        infinite_mode: Filter by infinite mode.
        search: Search string.
        sort_by: Sort field ('date' | 'score' | 'simulation_name').
        sort_order: Sort order ('asc' | 'desc').
        page: Page number (0-indexed).
        page_size: Page size.
        profile_ids: Filter by profiles (practice mode only).
        show_archived: Show archived attempts (practice mode only).
    """

    practice: bool = False
    start_date: str
    end_date: str
    cohort_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    department_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    simulation_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    scenario_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    infinite_mode: bool | None = None
    search: str | None = None
    sort_by: str | None = None  # 'date' | 'score' | 'simulation_name'
    sort_order: str | None = None  # 'asc' | 'desc'
    page: int | None = 0
    page_size: int | None = 20
    # Practice-only filters (ignored when practice=False)
    profile_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    show_archived: bool | None = False


class ChatSimulationCard(BaseModel):
    """Simulation card with analytical stats.

    SQL JOINs all metadata. Python computes: status, pass_pct, cohort_names_junction.
    Some fields are only populated based on mode:
    - completion_pct, passed_count, in_progress_count, not_started_count: instructional mode only
    - practice_simulation: practice mode only
    """

    view_mode: str  # 'member' | 'instructional' | 'practice'
    simulation_id: UUID
    simulation_name: str | None = None
    simulation_description: str | None = None
    time_limit: int | None = None
    num_sessions: int | None = None  # attempt_count
    highest_score: int | None = None
    standard_groups: list[str] | None = None  # standard_group_ids as strings
    color: str | None = None  # from persona
    icon: str | None = None  # from persona
    has_passed: bool | None = None
    # Computed by Python (business logic)
    status: str | None = None  # 'passed' | 'in-progress' | 'not-started'
    pass_pct: int | None = None  # computed from rubric points
    # Cohort info
    cohort_names_junction: str | None = None  # formatted "A, B, and C"
    # Instructional mode only (home with elevated role)
    completion_pct: int | None = None
    passed_count: int | None = None
    in_progress_count: int | None = None
    not_started_count: int | None = None
    # Practice mode only
    practice_simulation: bool | None = None  # True when practice=True


class ChatHistoryAttempt(BaseModel):
    """Attempt record for chat history.

    SQL JOINs all metadata. Python computes: score_status, show_view, show_continue, pass_pct.
    Some fields are only populated based on mode:
    - is_archived, practice_simulation, practice_scenario_id: practice mode only
    """

    attempt_id: UUID
    date: str | None = None  # ISO timestamp
    profile_id: UUID | None = None
    profile_name: str | None = None
    simulation_id: UUID | None = None
    simulation_name: str | None = None
    num_scenarios: int | None = None
    num_scenarios_completed: int | None = None
    infinite_mode: bool | None = None
    time_limit: int | None = None
    persona_names_junction: list[str] | None = None
    persona_colors_junction: list[str] | None = None
    scenario_ids: list[UUID] | None = None
    scenario_titles: list[str] | None = None
    department_ids: list[str] | None = None
    cohort_names_junction: list[str] | None = None
    # Computed by Python (business logic)
    score: int | None = None
    score_status: str | None = None  # 'high' | 'medium' | 'low'
    pass_pct: int | None = None
    show_view: bool | None = None
    show_continue: bool | None = None
    # Practice-only fields
    is_archived: bool | None = None
    practice_simulation: bool | None = None  # True when practice=True
    practice_scenario_id: UUID | None = None


class GetChatListResponse(BaseModel):
    """Client-facing API response for chat list (analytical).

    Combines simulation cards AND paginated attempt history in one response.
    """

    actor_name: str | None = None
    mode: str | None = None  # 'member' | 'instructional' | 'practice'
    has_data: bool | None = None
    # Simulation cards (overview)
    items: list[ChatSimulationCard] | None = None
    standard_groups: list[StandardGroupMapping] | None = None
    standards: list[StandardMapping] | None = None
    # Attempt history (paginated)
    data: list[ChatHistoryAttempt] | None = None
    total_count: int | None = None
    page: int | None = None
    page_size: int | None = None
    total_pages: int | None = None
    # Filter options
    simulation_options: list[FilterOption] | None = None
    scenario_options: list[FilterOption] | None = None
    profile_options: list[FilterOption] | None = None  # Practice-only


# =============================================================================
# GET endpoint types (OPERATIONAL) - Simulations user can take
# =============================================================================


class ChatSimulationOperational(BaseModel):
    """Simulation data for starting a chat session.

    Contains data needed to start a simulation AND card display stats.
    Now serves as the unified type for home/practice simulation cards.
    """

    simulation_id: UUID
    simulation_name: str | None = None
    simulation_description: str | None = None
    time_limit: int | None = None
    chat_entry_id: UUID | None = None
    home_id: UUID | None = None
    practice_id: UUID | None = None
    scenario_ids: list[UUID] | None = None  # Ordered list of scenario IDs
    cohort_ids: list[UUID] | None = None  # Cohorts this simulation belongs to
    # Display metadata
    color: str | None = None  # from persona
    icon: str | None = None  # from persona
    # Card stats from mv_profile_facts
    view_mode: str | None = None  # 'member' | 'instructional' | 'practice'
    num_sessions: int | None = None  # attempt_count
    highest_score: int | None = None  # highest_score_percent rounded
    has_passed: bool | None = None
    # Computed by Python (business logic)
    status: str | None = None  # 'passed' | 'in-progress' | 'not-started'
    pass_pct: int | None = None  # computed from rubric points
    # Cohort info
    cohort_names_junction: str | None = None  # formatted "A, B, and C"
    # Standard groups for rubric display
    standard_groups: list[str] | None = None  # standard_group_ids as strings
    # Practice mode flag
    practice_simulation: bool | None = None  # True when practice=True
    # Instructional mode only (home with elevated role)
    completion_pct: int | None = None
    passed_count: int | None = None
    in_progress_count: int | None = None
    not_started_count: int | None = None


# =============================================================================
# BUNDLE endpoint types (customize/start flow) — Section-first pattern
# =============================================================================


class GetChatRequest(BaseModel):
    """Client API request for one chat bundle customization payload."""

    chat_entry_id: UUID
    attempt_id: UUID | None = None
    draft_id: UUID | None = None


# --- Section types (one per resource) ---


class BaseChatSection(BaseModel):
    """Common metadata fields for all chat bundle resource sections."""

    show: bool = False
    required: bool = False
    suggestions: list[UUID] | None = None
    show_ai_generate: bool = False
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class ChatDepartmentSection(BaseChatSection):
    current: list[QGetDepartmentsV4Item] | None = None
    resources: list[QGetDepartmentsV4Item] | None = None


class ChatPersonaSection(BaseChatSection):
    current: list[QGetPersonasV4Item] | None = None
    resources: list[QGetPersonasV4Item] | None = None


class ChatDocumentSection(BaseChatSection):
    current: list[QGetDocumentsV4Item] | None = None
    resources: list[QGetDocumentsV4Item] | None = None


class ChatParameterFieldSection(BaseChatSection):
    current: list[QGetParameterFieldsV4Item] | None = None
    resources: list[QGetParameterFieldsV4Item] | None = None


class ChatScenarioSection(BaseChatSection):
    current: list[QGetScenariosV4Item] | None = None
    resources: list[QGetScenariosV4Item] | None = None


class ChatParameterSection(BaseChatSection):
    current: list[QGetParametersV4Item] | None = None
    resources: list[QGetParametersV4Item] | None = None


class ChatQuestionSection(BaseChatSection):
    current: list[QGetQuestionsV4Item] | None = None
    resources: list[QGetQuestionsV4Item] | None = None


class ChatOptionSection(BaseChatSection):
    current: list[QGetOptionsV4Item] | None = None
    resources: list[QGetOptionsV4Item] | None = None


class ChatVideoSection(BaseChatSection):
    current: list[QGetVideosV4Item] | None = None
    resources: list[QGetVideosV4Item] | None = None


class ChatImageSection(BaseChatSection):
    current: list[QGetImagesV4Item] | None = None
    resources: list[QGetImagesV4Item] | None = None


class ChatProblemStatementSection(BaseChatSection):
    current: list[QGetProblemStatementsV4Item] | None = None
    resources: list[QGetProblemStatementsV4Item] | None = None


class ChatObjectiveSection(BaseChatSection):
    current: list[QGetObjectivesV4Item] | None = None
    resources: list[QGetObjectivesV4Item] | None = None


# --- Scenario flags type ---


class ChatScenarioFlags(BaseModel):
    """Scenario-level flags that control section visibility."""

    video_enabled: bool = False
    problem_statement_enabled: bool = False
    objectives_enabled: bool = False
    images_enabled: bool = False
    questions_enabled: bool = False


# --- GET response (section-first) ---


class GetChatResponse(BaseModel):
    """Client-facing chat bundle response — section-first pattern."""

    chat_entry_id: UUID
    parent_id: UUID | None = None
    simulation_id: UUID | None = None
    simulation_name: str | None = None
    scenario_id: UUID | None = None
    profile_has_access: bool = False
    group_id: UUID | None = None
    draft_version: int | None = None
    scenario_flags: ChatScenarioFlags | None = None

    # 14 section-first resources
    departments: ChatDepartmentSection | None = None
    personas: ChatPersonaSection | None = None
    documents: ChatDocumentSection | None = None
    parameter_fields: ChatParameterFieldSection | None = None
    scenarios: ChatScenarioSection | None = None
    parameters: ChatParameterSection | None = None
    questions: ChatQuestionSection | None = None
    options: ChatOptionSection | None = None
    videos: ChatVideoSection | None = None
    images: ChatImageSection | None = None
    problem_statements: ChatProblemStatementSection | None = None
    objectives: ChatObjectiveSection | None = None

    # Config chain (hydrated for websocket/generation)
    config_agents: list[QGetAgentsV4Item] | None = None
    config_models: list[QGetModelsV4Item] | None = None
    config_providers: list[QGetProvidersV4Item] | None = None
    config_tools: list[QGetToolsV4Item] | None = None


# =============================================================================
# Bundle Websocket types
# =============================================================================


class ChatWebsocketEntries(BaseModel):
    """Draft view for chat bundle websocket consumers."""

    draft_training: QGetTrainingDraftsEntriesV4Item | None = None
    runs: GetRunListViewResponse | None = None


class ChatWebsocketResources(BaseModel):
    """Hydrated resources for chat bundle websocket — selected only."""

    departments: list[QGetDepartmentsV4Item] | None = None
    personas: list[QGetPersonasV4Item] | None = None
    documents: list[QGetDocumentsV4Item] | None = None
    parameter_fields: list[QGetParameterFieldsV4Item] | None = None
    scenarios: list[QGetScenariosV4Item] | None = None
    parameters: list[QGetParametersV4Item] | None = None
    questions: list[QGetQuestionsV4Item] | None = None
    options: list[QGetOptionsV4Item] | None = None
    videos: list[QGetVideosV4Item] | None = None
    images: list[QGetImagesV4Item] | None = None
    problem_statements: list[QGetProblemStatementsV4Item] | None = None
    objectives: list[QGetObjectivesV4Item] | None = None


class GetChatWebsocketResponse(InternalResponseBase):
    """Websocket-facing chat bundle response with hydrated resources."""

    entries: ChatWebsocketEntries | None = None
    resources: ChatWebsocketResources


# =============================================================================
# Bundle Draft action types
# =============================================================================


class ChatMultiResourceAction(BaseModel):
    """Multi-resource action for chat bundle draft patch."""

    resource_ids: list[UUID] | None = None
    create_tool_id: UUID | None = None
    link_tool_id: UUID | None = None


class PatchChatDraftApiRequest(BaseModel):
    """Request for patching a chat bundle draft - flat resource IDs."""

    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    expected_version: int = 0
    # 12 customizable resources (scenarios excluded — not user-customizable)
    department_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    document_ids: list[UUID] | None = None
    parameter_field_ids: list[UUID] | None = None
    parameter_ids: list[UUID] | None = None
    field_ids: list[UUID] | None = None
    question_ids: list[UUID] | None = None
    option_ids: list[UUID] | None = None
    video_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    problem_statement_ids: list[UUID] | None = None
    objective_ids: list[UUID] | None = None


class PatchChatDraftApiResponse(BaseModel):
    """Response for patching a chat bundle draft."""

    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


class PatchChatDraftSqlParams(BaseModel):
    """SQL parameters for patch chat bundle draft."""

    profile_id: UUID
    input_draft_id: UUID | None = None
    group_id: UUID | None = None
    departments: ChatMultiResourceAction
    personas: ChatMultiResourceAction
    documents: ChatMultiResourceAction
    parameter_fields: ChatMultiResourceAction
    parameters: ChatMultiResourceAction
    fields: ChatMultiResourceAction
    questions: ChatMultiResourceAction
    options: ChatMultiResourceAction
    videos: ChatMultiResourceAction
    images: ChatMultiResourceAction
    problem_statements: ChatMultiResourceAction
    objectives: ChatMultiResourceAction
    expected_version: int = 0

    @classmethod
    def from_request(
        cls,
        request: PatchChatDraftApiRequest,
        profile_id: UUID,
    ) -> "PatchChatDraftSqlParams":
        def wrap(ids: list[UUID] | None) -> ChatMultiResourceAction:
            return ChatMultiResourceAction(resource_ids=ids)

        return cls(
            profile_id=profile_id,
            input_draft_id=request.input_draft_id,
            group_id=request.group_id,
            departments=wrap(request.department_ids),
            personas=wrap(request.persona_ids),
            documents=wrap(request.document_ids),
            parameter_fields=wrap(request.parameter_field_ids),
            parameters=wrap(request.parameter_ids),
            fields=wrap(request.field_ids),
            questions=wrap(request.question_ids),
            options=wrap(request.option_ids),
            videos=wrap(request.video_ids),
            images=wrap(request.image_ids),
            problem_statements=wrap(request.problem_statement_ids),
            objectives=wrap(request.objective_ids),
            expected_version=request.expected_version,
        )

    def to_tuple(self) -> tuple[Any, ...]:
        def multi(a: ChatMultiResourceAction) -> tuple[Any, Any, Any]:
            return (a.resource_ids, a.create_tool_id, a.link_tool_id)

        return (
            self.profile_id,
            self.input_draft_id,
            self.group_id,
            multi(self.departments),
            multi(self.personas),
            multi(self.documents),
            multi(self.parameter_fields),
            multi(self.parameters),
            multi(self.fields),
            multi(self.questions),
            multi(self.options),
            multi(self.videos),
            multi(self.images),
            multi(self.problem_statements),
            multi(self.objectives),
            self.expected_version,
        )


class PatchChatDraftSqlRow(BaseModel):
    """SQL row for patch chat bundle draft."""

    draft_id: UUID | None = None
    new_version: int | None = None
    draft_exists: bool | None = None


# =============================================================================
# Chat START websocket types (for chat start socket handler)
# =============================================================================


class ChatStartWebsocketEntries(BaseModel):
    """Thin websocket views payload for chat start."""

    chat_entry_id: UUID
    department_id: UUID


class ChatStartWebsocketResources(BaseModel):
    """Chat resources for start websocket handlers."""

    simulation_id: UUID | None = None
    scenario_id: UUID | None = None
    problem_statement: str | None = None
    objectives: dict | list | None = None
    persona: dict | None = None
    video_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None
    has_problem_statement: bool = False
    has_persona: bool = False
    agent_id: UUID | None = None
    agent_exists: bool = False
    agent_name: str | None = None
    agent_is_active: bool = False
    model_id: UUID | None = None
    model_name: str | None = None
    provider_id: UUID | None = None
    provider_name: str | None = None
    has_api_key: bool = False
    requests_per_day: int | None = None
    runs_today: int = 0
    simulation_exists: bool = False
    simulation_is_active: bool = False
    profile_has_access: bool = False
    valid_entry_types: list[str] = Field(default_factory=list)


class GetChatStartWebsocketResponse(InternalResponseBase):
    """Websocket-facing chat start response."""

    entries: ChatStartWebsocketEntries
    resources: ChatStartWebsocketResources


# =============================================================================
# Backwards compatibility aliases (deprecated)
# =============================================================================

# These will be removed in a future version
GetChatHistoryRequest = GetChatListRequest
GetChatHistoryResponse = GetChatListResponse
GetChatOverviewRequest = GetChatListRequest
GetChatOverviewResponse = GetChatListResponse
