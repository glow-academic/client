"""Custom types for unified training endpoints.

These types define the client-facing API contract for both home and practice
modes via a single `practice: bool` parameter. Internal parameters (mode,
accessible_cohort_ids) are NOT included here - they are injected by Python.

Architecture:
- list.py (ANALYTICAL): Simulation cards + attempt history + filter options
- get.py (OPERATIONAL): Simulations user can take + scenario_ids + rubric data
"""

from uuid import UUID

from pydantic import BaseModel, Field
from app.api.v4.views.drafts.types import DraftScenarioViewItem
from app.sql.types import (
    QGetAgentsV4Item,
    QGetDepartmentsV4Item,
    QGetDocumentsV4Item,
    QGetModelsV4Item,
    QGetParameterFieldsV4Item,
    QGetPersonasV4Item,
    QGetProvidersV4Item,
    QGetScenarioTimeLimitsV4Item,
    QGetToolsV4Item,
)

# =============================================================================
# Shared types
# =============================================================================


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


class GetTrainingListRequest(BaseModel):
    """Client API request for training list (analytical).

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


class TrainingSimulationCard(BaseModel):
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


class TrainingHistoryAttempt(BaseModel):
    """Attempt record for training history.

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


class GetTrainingListResponse(BaseModel):
    """Client-facing API response for training list (analytical).

    Combines simulation cards AND paginated attempt history in one response.
    """

    actor_name: str | None = None
    mode: str | None = None  # 'member' | 'instructional' | 'practice'
    has_data: bool | None = None
    # Simulation cards (overview)
    items: list[TrainingSimulationCard] | None = None
    standard_groups: list[StandardGroupMapping] | None = None
    standards: list[StandardMapping] | None = None
    # Attempt history (paginated)
    data: list[TrainingHistoryAttempt] | None = None
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


class GetTrainingGetRequest(BaseModel):
    """Client API request for training get (operational).

    Returns simulations user can take with scenario_ids for starting.

    Args:
        practice: If True, returns practice simulations. If False, returns home simulations.
    """

    practice: bool = False


class TrainingSimulationOperational(BaseModel):
    """Simulation data for starting a training session.

    Contains data needed to start a simulation AND card display stats.
    Now serves as the unified type for home/practice simulation cards.
    """

    simulation_id: UUID
    simulation_name: str | None = None
    simulation_description: str | None = None
    time_limit: int | None = None
    training_bundle_entry_id: UUID | None = None
    scenario_ids: list[UUID] | None = None  # Ordered list of scenario IDs
    cohort_ids: list[UUID] | None = None  # Cohorts this simulation belongs to
    # Display metadata
    color: str | None = None  # from persona
    icon: str | None = None  # from persona
    # Card stats from mv_attempt_facts
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


class GetTrainingGetResponse(BaseModel):
    """Client-facing API response for training get (operational).

    Returns simulations user can take, scoped by their cohorts.
    """

    actor_name: str | None = None
    items: list[TrainingSimulationOperational] | None = None
    # Rubric data for pre-start display
    standard_groups: list[StandardGroupMapping] | None = None
    standards: list[StandardMapping] | None = None


# =============================================================================
# BUNDLE endpoint types (customize/start flow)
# =============================================================================


class GetTrainingBundleRequest(BaseModel):
    """Client API request for one training bundle customization payload."""

    training_bundle_entry_id: UUID
    draft_id: UUID | None = None


class TrainingBundleViews(BaseModel):
    """Draft/views payload for training bundle customization."""

    draft_training_bundle: DraftScenarioViewItem | None = None


class TrainingBundleResourceBucket(BaseModel):
    """Hydrated resource bucket for training bundle customization."""

    departments: list[QGetDepartmentsV4Item] | None = None
    personas: list[QGetPersonasV4Item] | None = None
    documents: list[QGetDocumentsV4Item] | None = None
    parameter_fields: list[QGetParameterFieldsV4Item] | None = None
    scenario_time_limits: list[QGetScenarioTimeLimitsV4Item] | None = None


class TrainingBundleResources(BaseModel):
    """Current/suggestions resources + config chain resources."""

    current: TrainingBundleResourceBucket | None = None
    suggestions: TrainingBundleResourceBucket | None = None
    agents: list[QGetAgentsV4Item] | None = None
    models: list[QGetModelsV4Item] | None = None
    providers: list[QGetProvidersV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None


class GetTrainingBundleResponse(BaseModel):
    """Client-facing bundle response following persona-style shape."""

    training_bundle_entry_id: UUID
    training_id: UUID | None = None
    simulation_id: UUID | None = None
    simulation_name: str | None = None
    scenario_id: UUID | None = None
    profile_has_access: bool = False
    views: TrainingBundleViews | None = None
    resources: TrainingBundleResources | None = None
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None


# =============================================================================
# Websocket endpoint types (shared internal fetch)
# =============================================================================


class TrainingWebsocketViews(BaseModel):
    """Thin websocket views payload."""

    training_bundle_entry_id: UUID
    department_id: UUID


class TrainingWebsocketResources(BaseModel):
    """Training resources for websocket handlers."""

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


class GetTrainingWebsocketResponse(BaseModel):
    """Websocket-facing training response."""

    views: TrainingWebsocketViews
    resources: TrainingWebsocketResources


# =============================================================================
# Backwards compatibility aliases (deprecated)
# =============================================================================

# These will be removed in a future version
GetTrainingHistoryRequest = GetTrainingListRequest
GetTrainingHistoryResponse = GetTrainingListResponse
GetTrainingOverviewRequest = GetTrainingListRequest
GetTrainingOverviewResponse = GetTrainingListResponse
