"""Custom types for NEW home endpoints.

These types define the client-facing API contract, separate from the
auto-generated SQL parameter types. The key difference is that internal
parameters (mode, accessible_cohort_ids) are NOT included here - they
are injected by Python from the context query.
"""

from uuid import UUID

from pydantic import BaseModel, Field


# =============================================================================
# Overview endpoint types (client-facing)
# =============================================================================


class SimulationCard(BaseModel):
    """Simulation card for home overview.

    SQL JOINs all metadata. Python computes: status, pass_pct, cohort_names_junction.
    """

    view_mode: str  # 'member' | 'instructional'
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
    # Instructional mode only
    completion_pct: int | None = None
    passed_count: int | None = None
    in_progress_count: int | None = None
    not_started_count: int | None = None
    # Cohort info
    cohort_names_junction: str | None = None  # formatted "A, B, and C"


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


class GetHomeOverviewNewResponse(BaseModel):
    """Client-facing API response for home overview."""

    actor_name: str | None = None
    mode: str | None = None  # 'member' | 'instructional'
    has_data: bool | None = None
    items: list[SimulationCard] | None = None
    standard_groups: list[StandardGroupMapping] | None = None
    standards: list[StandardMapping] | None = None


# =============================================================================
# History endpoint types (client-facing)
# =============================================================================


class GetHomeHistoryNewClientRequest(BaseModel):
    """Client API request for home history.

    Note: Home history is single-user (profile from auth header).
    Filters like roles, simulation_filters, profile_ids are not applicable.
    """

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


class HistoryAttempt(BaseModel):
    """Attempt record for home history.

    SQL JOINs all metadata. Python computes: score_status, show_view, show_continue, pass_pct.
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


class FilterOption(BaseModel):
    """Filter option for history dropdowns."""

    value: str
    label: str | None = None
    count: int | None = None


class GetHomeHistoryNewResponse(BaseModel):
    """Client-facing API response for home history."""

    actor_name: str | None = None
    data: list[HistoryAttempt] | None = None
    total_count: int | None = None
    page: int | None = None
    page_size: int | None = None
    total_pages: int | None = None
    simulation_options: list[FilterOption] | None = None
    scenario_options: list[FilterOption] | None = None


# =============================================================================
# Attempt detail endpoint types (client-facing)
# =============================================================================


class GetAttemptDetailRequest(BaseModel):
    """Client API request for attempt detail."""

    attempt_id: UUID


class HighlightEntry(BaseModel):
    """Highlight entry within a strength."""

    section: str | None = None
    idx: int | None = None


class ReplacementEntry(BaseModel):
    """Replacement entry within an improvement."""

    section: str | None = None
    replace_text: str | None = None
    idx: int | None = None


class StrengthEntry(BaseModel):
    """Strength feedback with highlights."""

    id: UUID
    message_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    highlights: list[HighlightEntry] | None = None


class ImprovementEntry(BaseModel):
    """Improvement feedback with replacements."""

    id: UUID
    message_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    replacements: list[ReplacementEntry] | None = None


class FeedbackEntry(BaseModel):
    """Feedback by standard for grading state."""

    id: UUID | None = None
    standard_id: UUID | None = None
    total: float | None = None
    feedback: str | None = None


class MessageData(BaseModel):
    """Message with content and feedback data."""

    id: UUID
    content: str | None = None
    type: str | None = None  # 'query' | 'response'
    created_at: str | None = None
    completed: bool | None = None
    strengths: list[StrengthEntry] | None = None
    improvements: list[ImprovementEntry] | None = None


class GradeData(BaseModel):
    """Grade information for a chat."""

    id: UUID | None = None
    score: int | None = None
    passed: bool | None = None
    description: str | None = None
    time_taken: int | None = None
    total_points: int | None = None
    pass_points: int | None = None


class ChatData(BaseModel):
    """Chat with scenario, persona, grade, and messages."""

    id: UUID
    scenario_id: UUID | None = None
    scenario_name: str | None = None
    problem_statement: str | None = None
    show_problem_statement: bool | None = None
    show_objectives: bool | None = None
    objectives: list[str] | None = None
    persona_id: UUID | None = None
    persona_name: str | None = None
    persona_icon: str | None = None
    persona_color: str | None = None
    completed: bool | None = None
    is_current: bool | None = None
    position: int | None = None
    grade: GradeData | None = None
    feedbacks: list[FeedbackEntry] | None = None
    messages: list[MessageData] | None = None


class SimulationData(BaseModel):
    """Simulation metadata."""

    id: UUID | None = None
    name: str | None = None
    description: str | None = None
    time_limit: int | None = None
    hints_enabled: bool | None = None
    objectives_enabled: bool | None = None
    image_input_active: bool | None = None
    copy_paste_allowed: bool | None = None


class AttemptData(BaseModel):
    """Attempt-level data."""

    id: UUID
    created_at: str | None = None
    infinite_mode: bool | None = None
    profile_id: UUID | None = None
    profile_name: str | None = None
    cohort_id: UUID | None = None
    department_id: UUID | None = None


class TimerData(BaseModel):
    """Timer information."""

    elapsed: int | None = None
    limit: int | None = None
    exceeded: bool | None = None
    formatted: str | None = None


class AggregatedResults(BaseModel):
    """Aggregated results for the attempt."""

    total_score: float | None = None
    total_possible_points: float | None = None
    percentage: float | None = None
    passed: bool | None = None
    chats_completed: int | None = None
    total_chats: int | None = None


class GetAttemptDetailResponse(BaseModel):
    """Client-facing API response for attempt detail."""

    actor_name: str | None = None
    attempt_exists: bool | None = None
    access_denied: bool | None = None
    attempt: AttemptData | None = None
    simulation: SimulationData | None = None
    chats: list[ChatData] | None = None
    timer: TimerData | None = None
    aggregated_results: AggregatedResults | None = None
