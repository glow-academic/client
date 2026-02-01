"""Custom types for unified attempt detail endpoint.

These types define the client-facing API contract for both home and practice
attempt detail via a single `practice: bool` parameter. Internal parameters
are NOT included here - they are injected by Python.
"""

from uuid import UUID

from pydantic import BaseModel


# =============================================================================
# Attempt detail endpoint types (client-facing)
# =============================================================================


class GetAttemptDetailRequest(BaseModel):
    """Client API request for attempt detail.

    Args:
        attempt_id: The attempt ID to fetch details for.
        practice: If True, includes hints in messages and is_archived in attempt.
            If False, includes cohort_id in attempt.
    """

    attempt_id: UUID
    practice: bool = False


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
    """Hint entry (practice mode only)."""

    message_id: UUID | None = None
    hint: str | None = None
    idx: int | None = None


class ContentEntry(BaseModel):
    """Content entry with persona info."""

    id: UUID
    content: str | None = None
    persona_id: UUID | None = None
    persona_name: str | None = None
    persona_color: str | None = None
    persona_icon: str | None = None
    created_at: str | None = None


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
    """Message with content and feedback data.

    The hints field is only populated when practice=True.
    """

    id: UUID
    content: str | None = None  # First content for backward compatibility
    type: str | None = None  # 'query' | 'response'
    created_at: str | None = None
    completed: bool | None = None
    # Contents array with persona info
    contents: list[ContentEntry] | None = None
    strengths: list[StrengthEntry] | None = None
    improvements: list[ImprovementEntry] | None = None
    # Practice mode only
    hints: list[HintEntry] | None = None


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
    """Attempt-level data.

    cohort_id is only populated when practice=False.
    is_archived is only populated when practice=True.
    """

    id: UUID
    created_at: str | None = None
    infinite_mode: bool | None = None
    profile_id: UUID | None = None
    profile_name: str | None = None
    department_id: UUID | None = None
    # Home mode only
    cohort_id: UUID | None = None
    # Practice mode only
    is_archived: bool | None = None


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
