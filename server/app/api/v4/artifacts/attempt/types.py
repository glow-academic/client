"""Custom types for unified attempt detail endpoint.

These types define the client-facing API contract for both home and practice
attempt detail via a single `practice: bool` parameter. Internal parameters
are NOT included here - they are injected by Python.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


# =============================================================================
# Attempt detail endpoint types (client-facing)
# =============================================================================


# -----------------------------------------------------------------------------
# Video/Quiz types
# -----------------------------------------------------------------------------


class VideoQuestionOption(BaseModel):
    """Option for a video question."""

    id: UUID
    option_text: str | None = None
    type: str | None = None
    is_correct: bool | None = None


class VideoQuestion(BaseModel):
    """Question for a video."""

    id: UUID
    question_text: str | None = None
    type: str | None = None
    allow_multiple: bool | None = None
    times: list[int] | None = None
    options: list[VideoQuestionOption] | None = None


class VideoData(BaseModel):
    """Video information for a chat."""

    id: UUID | None = None
    title: str | None = None
    length_seconds: int | None = None
    upload_id: UUID | None = None
    questions: list[VideoQuestion] | None = None
    show_image: bool | None = None


class QuizResponse(BaseModel):
    """Quiz response entry."""

    question_id: UUID | None = None
    option_id: UUID | None = None
    completed: bool | None = None
    created_at: datetime | None = None


class QuizData(BaseModel):
    """Quiz information for a chat."""

    id: UUID | None = None
    completed: bool | None = None
    responses: list[QuizResponse] | None = None


# -----------------------------------------------------------------------------
# Grading state types
# -----------------------------------------------------------------------------


class StandardAchievement(BaseModel):
    """Achievement for a standard."""

    standard_id: UUID | None = None
    achieved: bool | None = None


class StandardPass(BaseModel):
    """Pass status for a standard."""

    standard_id: UUID | None = None
    passed: bool | None = None


class StandardFeedback(BaseModel):
    """Feedback for a standard."""

    standard_id: UUID | None = None
    feedback: str | None = None


class GradingStateData(BaseModel):
    """Grading state for a chat."""

    achieved_standards: list[StandardAchievement] | None = None
    passed_standards: list[StandardPass] | None = None
    grade_description: str | None = None
    feedback_by_standard_id: list[StandardFeedback] | None = None


# -----------------------------------------------------------------------------
# Dynamic rubric types
# -----------------------------------------------------------------------------


class SkillScore(BaseModel):
    """Skill score entry."""

    skill_name: str | None = None
    score: float | None = None


class SkillFeedback(BaseModel):
    """Skill feedback entry."""

    skill_name: str | None = None
    feedback: str | None = None


class DynamicRubricData(BaseModel):
    """Dynamic rubric information for a chat."""

    chat_id: UUID | None = None
    score: float | None = None
    passed: bool | None = None
    time_taken: float | None = None
    skill_scores: list[SkillScore] | None = None
    skill_feedbacks: list[SkillFeedback] | None = None
    total_possible_points: float | None = None


# -----------------------------------------------------------------------------
# Rubric structure types
# -----------------------------------------------------------------------------


class StandardGroupStandards(BaseModel):
    """Standard group with standard IDs."""

    standard_group_id: UUID | None = None
    standard_ids: list[str] | None = None


class StandardGroupMapping(BaseModel):
    """Standard group mapping entry."""

    standard_group_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    points: float | None = None
    pass_points: float | None = None


class StandardMapping(BaseModel):
    """Standard mapping entry."""

    standard_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    points: float | None = None


class RubricStructureData(BaseModel):
    """Rubric structure data."""

    standard_groups: list[StandardGroupStandards] | None = None
    standard_groups_mapping: list[StandardGroupMapping] | None = None
    standards_mapping: list[StandardMapping] | None = None


# -----------------------------------------------------------------------------
# Scenario document types
# -----------------------------------------------------------------------------


class ScenarioDocumentEntry(BaseModel):
    """Scenario document entry."""

    document_id: UUID | None = None
    name: str | None = None
    type: str | None = None
    updated_at: datetime | None = None
    extension: str | None = None
    scenario_ids: list[str] | None = None
    can_edit: bool | None = None
    can_delete: bool | None = None
    active: bool | None = None
    department_ids: list[str] | None = None
    file_path: str | None = None
    mime_type: str | None = None
    upload_id: UUID | None = None
    field_ids: list[str] | None = None


# -----------------------------------------------------------------------------
# Persona types
# -----------------------------------------------------------------------------


class PersonaEntry(BaseModel):
    """Persona entry for lookup."""

    id: UUID | None = None
    name: str | None = None
    icon: str | None = None
    color: str | None = None


# -----------------------------------------------------------------------------
# Request/Response types
# -----------------------------------------------------------------------------


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
    """Content entry with computed display fields.

    Raw persona/profile data is transformed by Python business logic.
    Only computed fields (name, color, icon) are exposed to client.
    """

    id: UUID
    content: str | None = None
    name: str | None = None
    color: str | None = None
    icon: str | None = None
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


class HintsByMessage(BaseModel):
    """Hints grouped by message."""

    message_id: UUID | None = None
    hints: list[HintEntry] | None = None


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
    # Extended fields for full feature support
    video: VideoData | None = None
    quiz: QuizData | None = None
    grading_state: GradingStateData | None = None
    dynamic_rubric: DynamicRubricData | None = None
    personas: list[PersonaEntry] | None = None
    hints: list[HintsByMessage] | None = None
    document_ids: list[UUID] | None = None
    background_image: UUID | None = None
    # Scenario fields for frontend compatibility
    copy_paste_allowed: bool | None = None
    text_enabled: bool | None = None
    audio_enabled: bool | None = None
    content_type: str | None = None  # 'text' | 'video' | 'quiz'


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
    # Extended config fields
    practice_simulation: bool | None = None
    rubric_id: UUID | None = None


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


class ContinuationOption(BaseModel):
    """Continuation option for using previous chat results."""

    scenario_id: str | None = None
    scenario_name: str | None = None
    previous_chat_id: str | None = None
    title: str | None = None
    score: float | None = None
    percentage: float | None = None
    time_taken: float | None = None
    position: int | None = None


class AvailableContinuationOptions(BaseModel):
    """Available continuation options for an attempt."""

    next_sequential_options: list[ContinuationOption] | None = None


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
    # Navigation/UI control
    current_chat_index: int | None = None
    expected_chat_count: int | None = None
    is_active: bool | None = None
    show_results: bool | None = None
    should_show_controls: bool | None = None
    # Continuation options for infinite mode
    available_continuation_options: AvailableContinuationOptions | None = None
    # Extended data
    scenario_documents: list[ScenarioDocumentEntry] | None = None
    rubric_structure: RubricStructureData | None = None
