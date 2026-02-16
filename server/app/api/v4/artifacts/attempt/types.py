"""Custom types for unified attempt detail endpoint.

These types define the client-facing API contract for attempt detail.
The practice flag is determined server-side from the attempt data itself.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.api.v4.views.attempt.chats.types import ChatViewItem
from app.api.v4.views.attempt.list.types import AttemptViewItem
from app.api.v4.views.attempt.messages.types import MessageViewItem
from app.api.v4.views.run.list.types import GetRunListViewResponse
from app.sql.types import (
    QGetAgentsV4Item,
    QGetArgsOutputsV4Item,
    QGetArgsV4Item,
    QGetModelsV4Item,
    QGetProfilesV4Item,
    QGetProvidersV4Item,
    QGetToolsV4Item,
)

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
    template: bool | None = None


class AnalysisEntry(BaseModel):
    """Analysis entry for chat-level analysis content."""

    content: str | None = None


class ObjectiveEntry(BaseModel):
    """Objective entry with resource metadata."""

    objective_id: UUID | None = None
    objective: str | None = None


class ProblemStatementEntry(BaseModel):
    """Problem statement entry with resource metadata."""

    problem_statement_id: UUID | None = None
    problem_statement: str | None = None


class OptionEntry(BaseModel):
    """Option entry nested under a question."""

    option_id: UUID | None = None
    question_id: UUID | None = None
    option_text: str | None = None
    is_correct: bool | None = None


class QuestionEntry(BaseModel):
    """Question entry with nested options and times.

    Options are nested directly under the question.
    Times indicates video timestamps (seconds) when to show this question.
    """

    question_id: UUID | None = None
    question_text: str | None = None
    allow_multiple: bool | None = None
    times: list[int] | None = None  # Video timestamps when to show
    options: list[OptionEntry] | None = None  # Nested options


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
    instructions: str | None = None
    examples: list[str] | None = None


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
    """

    attempt_id: UUID


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
    name: str | None = None  # "You" for user messages, persona name for responses
    color: str | None = None  # Persona color (null for user messages)
    icon: str | None = None  # "User" for user messages, persona icon for responses
    created_at: str | None = None


class MessageFeedbackEntry(BaseModel):
    """Unified feedback entry for messages (strength or improvement).

    Combines strengths and improvements into a single type with a `type` field.
    - type="strength": has highlights (sections to highlight as good)
    - type="improvement": has replaces (sections to replace with suggestions)
    """

    id: str  # Unique ID: {message_id}-{type}-{index}
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
    chat_id: UUID | None = None
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


class ChatData(BaseModel):
    """Chat view data with IDs for related resources.

    Split into view categories:
    - Normal/General View: problem_statement, objectives, personas, images
    - Video/Quiz View: videos, questions, options, responses
    - Both Views: documents
    """

    id: UUID
    created_at: str | None = None
    completed: bool | None = None
    is_current: bool | None = None
    position: int | None = None
    grade: GradeData | None = None
    feedbacks: list[FeedbackEntry] | None = None
    analyses: list[AnalysisEntry] | None = None  # Chat-level analysis content

    # Chat-level flags
    show_problem_statement: bool | None = None
    show_objectives: bool | None = None
    copy_paste_allowed: bool | None = None
    text_enabled: bool | None = None
    audio_enabled: bool | None = None

    # Extended fields for full feature support
    grading_state: GradingStateData | None = None
    dynamic_rubric: DynamicRubricData | None = None

    # --- Scenario resource ID ---
    scenario_id: UUID | None = None

    # --- Normal/General View resource IDs ---
    problem_statement_id: UUID | None = None
    objective_ids: list[UUID] | None = None
    persona_ids: list[UUID] | None = None
    image_ids: list[UUID] | None = None

    # --- Video/Quiz View resource IDs ---
    video_ids: list[UUID] | None = None
    question_ids: list[UUID] | None = None
    option_ids: list[UUID] | None = None
    responses: list[QuizResponse] | None = None

    # --- Both Views resource IDs ---
    document_ids: list[UUID] | None = None

    # --- Rubric/Grade resource IDs ---
    rubric_id: UUID | None = None
    standard_group_ids: list[UUID] | None = None
    standard_ids: list[UUID] | None = None


class AttemptResources(BaseModel):
    """Resource maps keyed by ID string."""

    scenarios: dict[str, ScenarioEntry] | None = None
    personas: dict[str, PersonaEntry] | None = None
    documents: dict[str, DocumentEntry] | None = None
    images: dict[str, ImageEntry] | None = None
    videos: dict[str, VideoEntry] | None = None
    objectives: dict[str, ObjectiveEntry] | None = None
    questions: dict[str, QuestionEntry] | None = None
    options: dict[str, OptionEntry] | None = None
    problem_statements: dict[str, ProblemStatementEntry] | None = None
    rubrics: dict[str, RubricEntry] | None = None
    standard_groups: dict[str, StandardGroupEntry] | None = None
    standards: dict[str, StandardEntry] | None = None


class AttemptViews(BaseModel):
    """View payloads grouped by view type."""

    simulation_attempts: list[AttemptViewItem] | None = None
    simulation_chats: list[ChatData] | None = None
    simulation_messages: list[MessageData] | None = None
    runs: GetRunListViewResponse | None = None


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
    negative: bool | None = None  # Allows timer to go negative


class AggregatedResults(BaseModel):
    """Aggregated results for the attempt."""

    total_score: float | None = None
    total_possible_points: float | None = None
    percentage: float | None = None
    passed: bool | None = None
    chats_completed: int | None = None
    total_chats: int | None = None


class PreviousChatOption(BaseModel):
    """A single scenario's best previous graded chat."""

    scenario_id: str | None = None
    scenario_name: str | None = None
    previous_chat_id: str | None = None
    score: float | None = None
    percentage: float | None = None
    time_taken: float | None = None
    position: int | None = None


class ContinuationOption(BaseModel):
    """A bundle of consecutive scenarios that can be reused from previous attempts."""

    scenarios: list[PreviousChatOption]
    total_score: float
    total_percentage: float | None = None
    total_time: float


class AvailableContinuationOptions(BaseModel):
    """Available continuation options for an attempt."""

    options: list[ContinuationOption]


class GetAttemptDetailResponse(BaseModel):
    """Client-facing API response for attempt detail."""

    actor_name: str | None = None
    attempt_exists: bool | None = None
    access_denied: bool | None = None
    attempt: AttemptData | None = None
    simulation: SimulationData | None = None
    timer: TimerData | None = None
    aggregated_results: AggregatedResults | None = None
    # Navigation/UI control
    current_chat_index: int | None = None
    expected_chat_count: int | None = None
    is_active: bool | None = None
    is_lobby: bool | None = None
    show_results: bool | None = None
    should_show_controls: bool | None = None
    is_own_attempt: bool | None = None
    # Continuation options for infinite mode
    available_continuation_options: AvailableContinuationOptions | None = None
    # Extended data (scenario_documents removed - use chat.documents)
    rubric_structure: RubricStructureData | None = None
    # Training context (for lobby flow)
    training_id: UUID | None = None
    training_bundle_entry_id: UUID | None = None
    # New normalized maps
    resources: AttemptResources | None = None
    views: AttemptViews | None = None


# =============================================================================
# Internal data (three-layer BFF pattern)
# =============================================================================


@dataclass
class AttemptInternalData:
    """Core data container returned by get_attempt_internal().

    Contains all fetched and computed values. Consumer layers
    (get_attempt_client, get_attempt_websocket) reshape this
    into their specific response types.
    """

    # Access context
    actor_name: str | None
    attempt_exists: bool
    access_denied: bool
    is_own_attempt: bool
    practice: bool
    profiles_id: UUID | None

    # Metadata
    profile_name: str | None
    simulation_name: str | None
    training_id: UUID | None
    training_bundle_entry_id: UUID | None

    # Config chain
    group_id: UUID | None
    agent_ids: dict[str, UUID | None] = field(default_factory=dict)

    # Raw MV results
    attempt_item: AttemptViewItem | None = None
    chats_result: list[ChatViewItem] | None = None
    messages_result: list[MessageViewItem] | None = None

    # Resource metadata (raw lookup dict)
    resource_meta: dict[str, dict[UUID, dict]] = field(default_factory=dict)

    # Assembled payloads
    resources_payload: AttemptResources = field(default_factory=AttemptResources)
    chats: list[ChatData] = field(default_factory=list)
    messages: list[MessageData] = field(default_factory=list)

    # Computed business logic
    attempt: AttemptData | None = None
    simulation: SimulationData | None = None
    timer: TimerData | None = None
    aggregated_results: AggregatedResults | None = None
    current_chat_index: int | None = None
    expected_chat_count: int | None = None
    is_active: bool = True
    is_lobby: bool = False
    show_results: bool = False
    should_show_controls: bool = False
    rubric_structure: RubricStructureData | None = None
    continuation_options: AvailableContinuationOptions | None = None

    # Config resources (from group -> config chain)
    config_agent_resources: list[QGetAgentsV4Item] | None = None
    config_model_resources: list[QGetModelsV4Item] | None = None
    config_provider_resources: list[QGetProvidersV4Item] | None = None


# =============================================================================
# WebSocket response types (three-layer BFF pattern)
# =============================================================================


class AttemptWebsocketResources(BaseModel):
    """Content resources + config resources for websocket."""

    # Content resources (same shape as AttemptResources)
    scenarios: dict[str, ScenarioEntry] | None = None
    personas: dict[str, PersonaEntry] | None = None
    documents: dict[str, DocumentEntry] | None = None
    images: dict[str, ImageEntry] | None = None
    videos: dict[str, VideoEntry] | None = None
    objectives: dict[str, ObjectiveEntry] | None = None
    questions: dict[str, QuestionEntry] | None = None
    options: dict[str, OptionEntry] | None = None
    problem_statements: dict[str, ProblemStatementEntry] | None = None
    rubrics: dict[str, RubricEntry] | None = None
    standard_groups: dict[str, StandardGroupEntry] | None = None
    standards: dict[str, StandardEntry] | None = None
    # Config resources
    agents: list[QGetAgentsV4Item] | None = None
    models: list[QGetModelsV4Item] | None = None
    providers: list[QGetProvidersV4Item] | None = None
    tools: list[QGetToolsV4Item] | None = None
    config_args: list[QGetArgsV4Item] | None = None
    config_args_outputs: list[QGetArgsOutputsV4Item] | None = None
    # Profile config (for rate limiting)
    config_profile: list[QGetProfilesV4Item] | None = None


class GetAttemptWebsocketResponse(BaseModel):
    """Minimal response for WebSocket handlers."""

    views: AttemptViews | None = None
    resources: AttemptWebsocketResources | None = None
    resource_agent_ids: dict[str, UUID | None] | None = None
    group_id: UUID | None = None


# =============================================================================
# Attempt list endpoint types (unified history payload)
# =============================================================================


class AttemptListFilterOption(BaseModel):
    """Filter option for attempt history dropdowns."""

    value: str
    label: str | None = None
    count: int | None = None


class GetAttemptListRequest(BaseModel):
    """Request for unified attempt list/history fetch."""

    practice: bool = False
    target_profile_id: UUID | None = None
    start_date: str | None = None
    end_date: str | None = None
    cohort_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    department_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    simulation_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    scenario_ids: list[UUID] | None = Field(default_factory=list)  # type: ignore[arg-type]
    infinite_mode: bool | None = None
    search: str | None = None
    profile_search: str | None = None
    simulation_search: str | None = None
    scenario_search: str | None = None
    sort_by: str | None = "date"
    sort_order: str | None = "desc"
    page: int = 0
    page_size: int = 20
    show_archived: bool = False


class AttemptListItem(BaseModel):
    """Unified attempt history row shape."""

    attempt_id: UUID
    date: str | None = None
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
    score: int | None = None
    score_status: str | None = None
    pass_pct: int | None = None
    show_view: bool | None = None
    show_continue: bool | None = None
    is_archived: bool | None = None
    practice_simulation: bool | None = None
    practice_scenario_id: UUID | None = None


class GetAttemptListResponse(BaseModel):
    """Response for unified attempt list/history fetch."""

    actor_name: str | None = None
    data: list[AttemptListItem] = Field(default_factory=list)
    total_count: int = 0
    page: int = 0
    page_size: int = 20
    total_pages: int = 0
    simulation_options: list[AttemptListFilterOption] | None = None
    scenario_options: list[AttemptListFilterOption] | None = None
    profile_options: list[AttemptListFilterOption] | None = None
