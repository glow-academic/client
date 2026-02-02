"""Custom types for NEW practice endpoints.

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


class GetPracticeOverviewNewClientRequest(BaseModel):
    """Client API request for practice overview.

    Note: profile_id is NOT included here - it comes from the X-Profile-Id header.
    """

    department_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]


class PracticeSimulationCard(BaseModel):
    """Simulation card for practice overview.

    SQL JOINs all metadata. Python computes: status, pass_pct, cohort_names_junction.
    """

    view_mode: str  # Always 'practice'
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
    # Practice-specific
    practice_simulation: bool = True  # Always True for practice
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


class GetPracticeOverviewNewResponse(BaseModel):
    """Client-facing API response for practice overview."""

    actor_name: str | None = None
    mode: str | None = None  # Always 'practice'
    has_data: bool | None = None
    items: list[PracticeSimulationCard] | None = None
    standard_groups: list[StandardGroupMapping] | None = None
    standards: list[StandardMapping] | None = None


# =============================================================================
# History endpoint types (client-facing)
# =============================================================================


class GetPracticeHistoryNewClientRequest(BaseModel):
    """Client API request for practice history.

    Note: Practice history supports multi-user view (profile_ids filter).
    """

    start_date: str
    end_date: str
    cohort_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    department_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    simulation_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    scenario_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    profile_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    infinite_mode: bool | None = None
    show_archived: bool | None = False
    search: str | None = None
    sort_by: str | None = None  # 'date' | 'score' | 'simulation_name'
    sort_order: str | None = None  # 'asc' | 'desc'
    page: int | None = 0
    page_size: int | None = 20


class PracticeHistoryAttempt(BaseModel):
    """Attempt record for practice history.

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
    is_archived: bool | None = None
    # Computed by Python (business logic)
    score: int | None = None
    score_status: str | None = None  # 'high' | 'medium' | 'low'
    pass_pct: int | None = None
    show_view: bool | None = None
    show_continue: bool | None = None
    # Practice-specific
    practice_simulation: bool = True  # Always True for practice
    practice_scenario_id: UUID | None = None


class FilterOption(BaseModel):
    """Filter option for history dropdowns."""

    value: str
    label: str | None = None
    count: int | None = None


class GetPracticeHistoryNewResponse(BaseModel):
    """Client-facing API response for practice history."""

    actor_name: str | None = None
    data: list[PracticeHistoryAttempt] | None = None
    total_count: int | None = None
    page: int | None = None
    page_size: int | None = None
    total_pages: int | None = None
    simulation_options: list[FilterOption] | None = None
    scenario_options: list[FilterOption] | None = None
    profile_options: list[FilterOption] | None = None  # Practice supports multi-user


# =============================================================================
# Attempt detail endpoint types (client-facing)
# =============================================================================


class GetPracticeAttemptDetailRequest(BaseModel):
    """Client API request for practice attempt detail."""

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


class HintEntry(BaseModel):
    """Hint entry (PRACTICE-specific)."""

    message_id: UUID | None = None
    hint: str | None = None
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


class PracticeMessageData(BaseModel):
    """Message with content, hints, and feedback data (PRACTICE)."""

    id: UUID
    content: str | None = None
    type: str | None = None  # 'query' | 'response'
    created_at: str | None = None
    completed: bool | None = None
    hints: list[HintEntry] | None = None  # PRACTICE-specific
    strengths: list[StrengthEntry] | None = None
    improvements: list[ImprovementEntry] | None = None


class GradeData(BaseModel):
    """Grade information for a chat."""

    id: UUID | None = None
    score: int | None = None
    passed: bool | None = None
    time_taken: int | None = None
    total_points: int | None = None
    pass_points: int | None = None


class PracticeChatData(BaseModel):
    """Chat with scenario, persona, grade, and messages (PRACTICE)."""

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
    messages: list[PracticeMessageData] | None = None


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


class PracticeAttemptData(BaseModel):
    """Attempt-level data (PRACTICE)."""

    id: UUID
    created_at: str | None = None
    infinite_mode: bool | None = None
    is_archived: bool | None = None  # PRACTICE-specific
    profile_id: UUID | None = None
    profile_name: str | None = None
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


class GetPracticeAttemptDetailResponse(BaseModel):
    """Client-facing API response for practice attempt detail."""

    actor_name: str | None = None
    attempt_exists: bool | None = None
    access_denied: bool | None = None
    attempt: PracticeAttemptData | None = None
    simulation: SimulationData | None = None
    chats: list[PracticeChatData] | None = None
    timer: TimerData | None = None
    aggregated_results: AggregatedResults | None = None
