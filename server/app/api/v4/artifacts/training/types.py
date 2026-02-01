"""Custom types for unified training endpoints.

These types define the client-facing API contract for both home and practice
modes via a single `practice: bool` parameter. Internal parameters (mode,
accessible_cohort_ids) are NOT included here - they are injected by Python.
"""

from uuid import UUID

from pydantic import BaseModel, Field


# =============================================================================
# Overview endpoint types (client-facing)
# =============================================================================


class GetTrainingOverviewRequest(BaseModel):
    """Client API request for training overview.

    Args:
        practice: If True, returns practice simulations. If False, returns home simulations.
        department_ids: Filter by departments (applies to both modes).
        simulation_ids: Filter by simulations (ignored when practice=True).
        cohort_ids: Filter by cohorts (ignored when practice=True).
        start_date: Filter by start date (ignored when practice=True).
        end_date: Filter by end date (ignored when practice=True).
    """

    practice: bool = False
    department_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    # Home-only filters (ignored when practice=True)
    simulation_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    cohort_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    start_date: str | None = None
    end_date: str | None = None


class TrainingSimulationCard(BaseModel):
    """Simulation card for training overview.

    SQL JOINs all metadata. Python computes: status, pass_pct, cohort_names_junction.
    Some fields are only populated based on mode:
    - completion_pct, passed_count, in_progress_count, not_started_count: instructional mode only
    - practice_simulation, practice_scenario_id: practice mode only
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
    practice_scenario_id: UUID | None = None


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


class GetTrainingOverviewResponse(BaseModel):
    """Client-facing API response for training overview."""

    actor_name: str | None = None
    mode: str | None = None  # 'member' | 'instructional' | 'practice'
    has_data: bool | None = None
    items: list[TrainingSimulationCard] | None = None
    standard_groups: list[StandardGroupMapping] | None = None
    standards: list[StandardMapping] | None = None


# =============================================================================
# History endpoint types (client-facing)
# =============================================================================


class GetTrainingHistoryRequest(BaseModel):
    """Client API request for training history.

    Args:
        practice: If True, returns practice history. If False, returns home history.
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
        profile_ids: Filter by profiles (practice mode only, ignored when practice=False).
        show_archived: Show archived attempts (practice mode only, ignored when practice=False).
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


class FilterOption(BaseModel):
    """Filter option for history dropdowns."""

    value: str
    label: str | None = None
    count: int | None = None


class GetTrainingHistoryResponse(BaseModel):
    """Client-facing API response for training history."""

    actor_name: str | None = None
    data: list[TrainingHistoryAttempt] | None = None
    total_count: int | None = None
    page: int | None = None
    page_size: int | None = None
    total_pages: int | None = None
    simulation_options: list[FilterOption] | None = None
    scenario_options: list[FilterOption] | None = None
    # Practice-only filter options
    profile_options: list[FilterOption] | None = None
