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
    """Video information for a chat (legacy - use VideoEntry instead)."""

    id: UUID | None = None
    title: str | None = None
    length_seconds: int | None = None
    upload_id: UUID | None = None
    questions: list[VideoQuestion] | None = None
    show_image: bool | None = None


# -----------------------------------------------------------------------------
# Unified asset entry types (id, upload_id, name, description)
# -----------------------------------------------------------------------------


class ImageEntry(BaseModel):
    """Image entry with resource metadata."""

    image_id: UUID | None = None
    upload_id: UUID | None = None
    name: str | None = None
    description: str | None = None


class VideoEntry(BaseModel):
    """Video entry with resource metadata."""

    video_id: UUID | None = None
    upload_id: UUID | None = None
    name: str | None = None
    description: str | None = None


class DocumentEntry(BaseModel):
    """Document entry with resource metadata."""

    document_id: UUID | None = None
    upload_id: UUID | None = None
    name: str | None = None
    description: str | None = None


class TemplateEntry(BaseModel):
    """Template entry with resource metadata."""

    template_id: UUID | None = None
    name: str | None = None
    description: str | None = None


class ObjectiveEntry(BaseModel):
    """Objective entry with resource metadata."""

    objective_id: UUID | None = None
    objective: str | None = None


class ProblemStatementEntry(BaseModel):
    """Problem statement entry with resource metadata."""

    problem_statement_id: UUID | None = None
    problem_statement: str | None = None


class QuestionEntry(BaseModel):
    """Question entry with resource metadata."""

    question_id: UUID | None = None
    question_text: str | None = None
    allow_multiple: bool | None = None


class OptionEntry(BaseModel):
    """Option entry with resource metadata."""

    option_id: UUID | None = None
    option_text: str | None = None
    is_correct: bool | None = None


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
# Grading state types (Record format - server sends what client needs)
# -----------------------------------------------------------------------------


class GradingStateData(BaseModel):
    """Grading state for a chat in Record format.

    All fields are Records keyed by standard_id strings.
    This is the exact format the client needs - no transformation required.
    """

    # standard_id -> achieved (boolean)
    achieved_standards: dict[str, bool] | None = None
    # standard_id -> passed (boolean)
    passed_standards: dict[str, bool] | None = None
    grade_description: str | None = None
    # standard_id -> feedback (string)
    feedback_by_standard_id: dict[str, str] | None = None


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
# Rubric structure types (Record format - server sends what client needs)
# -----------------------------------------------------------------------------


class StandardGroupMeta(BaseModel):
    """Standard group metadata for rubric display."""

    name: str | None = None
    description: str | None = None
    points: float | None = None
    pass_points: float | None = None


class StandardMeta(BaseModel):
    """Standard metadata for rubric display."""

    name: str | None = None
    description: str | None = None
    points: float | None = None


class RubricStructureData(BaseModel):
    """Rubric structure data in Record format.

    All fields are Records keyed by standard_group_id or standard_id strings.
    This is the exact format the client needs - no transformation required.
    """

    # standard_group_id -> list of standard_id strings
    standard_groups: dict[str, list[str]] | None = None
    # standard_group_id -> metadata
    standard_groups_mapping: dict[str, StandardGroupMeta] | None = None
    # standard_id -> metadata
    standards_mapping: dict[str, StandardMeta] | None = None


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
# Scenario entry types (enriched from internal handlers)
# -----------------------------------------------------------------------------


class ScenarioEntry(BaseModel):
    """Scenario entry with resource metadata."""

    scenario_id: UUID | None = None
    name: str | None = None
    description: str | None = None


# -----------------------------------------------------------------------------
# Rubric/Grade entry types (enriched from internal handlers)
# -----------------------------------------------------------------------------


class RubricEntry(BaseModel):
    """Rubric entry with resource metadata."""

    rubric_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    total_points: float | None = None
    pass_points: float | None = None


class StandardGroupEntry(BaseModel):
    """Standard group entry with resource metadata."""

    standard_group_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    points: float | None = None
    pass_points: float | None = None


class StandardEntry(BaseModel):
    """Standard entry with resource metadata."""

    standard_id: UUID | None = None
    standard_group_id: UUID | None = None
    name: str | None = None
    description: str | None = None
    points: float | None = None


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
    replace: str | None = None  # The replacement text
    idx: int | None = None


class HintEntry(BaseModel):
    """Hint entry (practice mode only, message_id implied by parent)."""

    hint: str | None = None
    idx: int | None = None


class ContentEntry(BaseModel):
    """Content entry with computed display fields.

    Each content has its own display info (name/icon/color) computed from
    persona metadata on the server. Client renders each content with its
    own persona styling.
    """

    content: str | None = None
    name: str | None = None    # "You" for user messages, persona name for responses
    color: str | None = None   # Persona color (null for user messages)
    icon: str | None = None    # "User" for user messages, persona icon for responses
    created_at: str | None = None


class MessageFeedbackEntry(BaseModel):
    """Unified feedback entry for messages (strength or improvement).

    Combines strengths and improvements into a single type with a `type` field.
    - type="strength": has highlights (sections to highlight as good)
    - type="improvement": has replaces (sections to replace with suggestions)
    """

    id: UUID
    name: str | None = None
    description: str | None = None
    type: str | None = None  # "strength" | "improvement"
    highlights: list[HighlightEntry] | None = None  # For strengths
    replaces: list[ReplacementEntry] | None = None  # For improvements


class FeedbackEntry(BaseModel):
    """Feedback by standard for grading state.

    standard_group_id is derived from standards metadata lookup.
    """

    id: UUID | None = None
    standard_id: UUID | None = None
    standard_group_id: UUID | None = None  # From standards metadata
    total: float | None = None
    feedback: str | None = None


class MessageData(BaseModel):
    """Message with contents, feedbacks, and hints.

    - contents: Array of content entries with display info (name/icon/color)
    - feedbacks: Unified strengths/improvements (only present after grading)
    - hints: Practice mode hints (only present in practice mode)
    """

    id: UUID
    type: str | None = None  # 'query' | 'response'
    created_at: str | None = None
    completed: bool | None = None
    # Contents array with display info (name/icon/color per content)
    contents: list[ContentEntry] | None = None
    # Unified feedbacks (strengths + improvements with type field)
    feedbacks: list[MessageFeedbackEntry] | None = None
    # Practice mode only
    hints: list[HintEntry] | None = None


class GradeData(BaseModel):
    """Grade information for a chat (no id - not a resource)."""

    score: float | None = None
    passed: bool | None = None
    description: str | None = None
    time_taken: int | None = None
    total_points: float | None = None
    pass_points: float | None = None


class HintsByMessage(BaseModel):
    """Hints grouped by message."""

    message_id: UUID | None = None
    hints: list[HintEntry] | None = None


class ChatData(BaseModel):
    """Chat with scenario, persona, grade, and messages.

    Split into view categories:
    - Normal/General View: problem_statement, objectives, personas, images
    - Video/Quiz View: videos, questions, options, responses
    - Both Views: documents, templates
    """

    id: UUID
    completed: bool | None = None
    is_current: bool | None = None
    position: int | None = None
    grade: GradeData | None = None
    feedbacks: list[FeedbackEntry] | None = None
    messages: list[MessageData] | None = None

    # Chat-level flags
    show_problem_statement: bool | None = None
    show_objectives: bool | None = None
    copy_paste_allowed: bool | None = None
    text_enabled: bool | None = None
    audio_enabled: bool | None = None

    # Extended fields for full feature support
    grading_state: GradingStateData | None = None
    dynamic_rubric: DynamicRubricData | None = None
    hints: list[HintsByMessage] | None = None

    # --- Scenario resource (enriched from internal handler) ---
    scenario: ScenarioEntry | None = None

    # --- Normal/General View resources ---
    problem_statement: ProblemStatementEntry | None = None
    objectives: list[ObjectiveEntry] | None = None
    personas: list[PersonaEntry] | None = None
    images: list[ImageEntry] | None = None

    # --- Video/Quiz View resources ---
    videos: list[VideoEntry] | None = None
    questions: list[QuestionEntry] | None = None
    options: list[OptionEntry] | None = None
    responses: list[QuizResponse] | None = None

    # --- Both Views resources ---
    documents: list[DocumentEntry] | None = None
    templates: list[TemplateEntry] | None = None

    # --- Rubric/Grade resources (enriched from internal handlers) ---
    rubric: RubricEntry | None = None
    standard_groups: list[StandardGroupEntry] | None = None
    standards: list[StandardEntry] | None = None


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
    # Extended data (scenario_documents removed - use chat.documents)
    rubric_structure: RubricStructureData | None = None
