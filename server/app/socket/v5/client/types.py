"""Unified client payload types for v5 WebSocket generation.

Instead of per-artifact payload classes (GenerateAgentPayload, GenerateAuthPayload, …),
v5 uses a single GeneratePayload that carries the artifact_type discriminator and a
generic artifact_id field. The registry maps these to the correct fetcher kwarg.
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel


class GeneratePayload(BaseModel):
    """Unified client-to-server payload for the `generate` WebSocket event.

    Fields:
        artifact_type: Registry key (e.g. "agent", "training", "auth").
        artifact_id:   Generic artifact ID — maps to agent_id, training_entry_id, etc.
        draft_id:      Optional draft ID (required for most artifacts).
        resource_types: Which resources to generate.
        user_instructions: Optional user instructions forwarded to LLM.
        save:          Whether to auto-save on completion.

        # Pass-through fields (training-specific, forwarded to internal emit)
        attempt_id:    Optional attempt context.
        chat_resolved_id: Optional chat resolved context.
        staff_id:      Optional staff ID (profile artifact resolves to target_profile_id).

        # Pre-created IDs (skip prepare step when populated)
        run_id:        Pre-created run ID from handler prepare SQL.
        group_id:      Pre-created or existing group ID.

        # Extra pass-through for attempt message/grade
        chat_id:       Chat ID for message/grade context.
        grade_id:      Grade ID for grade context.
        message:       User message text.
        voice_mode:    Whether message is from voice input.
        upload_id:     Optional upload attachment ID.

        # Extra messages (chat history, appended after developer msgs)
        extra_messages: Pre-built messages (e.g. chat history) — not persisted.
    """

    artifact_type: str
    artifact_id: UUID | None = None
    draft_id: UUID | None = None
    resource_types: list[str]
    user_instructions: list[str] | None = None
    save: bool = True

    # Pass-through context fields
    attempt_id: str | None = None
    chat_resolved_id: str | None = None
    staff_id: str | None = None

    # Pre-created IDs (skip prepare step when populated)
    run_id: str | None = None
    group_id: str | None = None

    # Extra pass-through for attempt message/grade
    chat_id: str | None = None
    grade_id: str | None = None
    message: str | None = None
    voice_mode: bool = False
    upload_id: str | None = None

    # Extra messages (chat history, appended after developer msgs)
    extra_messages: list[dict[str, str]] | None = None


# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------


class ConnectionConfirmedPayload(BaseModel):
    """Server-to-client: connection confirmed."""

    sid: str
    profile_id: str | None
    guest_id: str | None
    server_time: float


# ---------------------------------------------------------------------------
# Attempt room management
# ---------------------------------------------------------------------------


class AttemptJoinPayload(BaseModel):
    """Client-to-server: join a chat room for real-time updates."""

    chat_id: UUID


class AttemptLeavePayload(BaseModel):
    """Client-to-server: leave a chat room."""

    chat_id: UUID


class AttemptJoinedEvent(BaseModel):
    """Server-to-client: successfully joined a chat room."""

    chat_id: str
    success: bool


# ---------------------------------------------------------------------------
# Test room management
# ---------------------------------------------------------------------------


class TestJoinPayload(BaseModel):
    """Client-to-server: join a test room for real-time updates."""

    invocation_id: UUID


class TestLeavePayload(BaseModel):
    """Client-to-server: leave a test room."""

    invocation_id: UUID


class TestStartPayload(BaseModel):
    """Client-to-server: start test (create or next mode)."""

    eval_id: UUID | None = None
    test_id: UUID | None = None
    infinite_mode: bool = False


class TestRunPayload(BaseModel):
    """Client-to-server: run one auto-regressive replay."""

    invocation_id: UUID
    test_id: UUID


class TestEndPayload(BaseModel):
    """Client-to-server: end test (triggers grading)."""

    invocation_id: UUID
    test_id: UUID
    run_id: UUID


class TestStopPayload(BaseModel):
    """Client-to-server: stop current test execution."""

    invocation_id: UUID


class TestJoinedEvent(BaseModel):
    """Server-to-client: successfully joined a test room."""

    invocation_id: str
    success: bool = True


class TestStartedEvent(BaseModel):
    """Server-to-client: test created."""

    test_id: str


class TestRunStartEvent(BaseModel):
    """Server-to-client: run replay started."""

    invocation_id: str
    run_id: str
    original_run_resource_id: str | None = None
    current_run: int
    total_runs: int
    created_at: str


class TestRunDeltaEvent(BaseModel):
    """Server-to-client: generation progress delta."""

    invocation_id: str
    run_id: str
    content: str


class TestRunCompleteEvent(BaseModel):
    """Server-to-client: single run replay completed."""

    invocation_id: str
    run_id: str
    original_run_resource_id: str | None = None
    tool_calls: list[dict[str, Any]] | None = None
    current_run: int
    total_runs: int
    remaining_runs: int


class TestAllCompleteEvent(BaseModel):
    """Server-to-client: all runs complete."""

    invocation_id: str
    total_runs: int
    success: bool = True


class TestGradedEvent(BaseModel):
    """Server-to-client: grading completed."""

    invocation_id: str
    grade_id: str | None = None
    score: float | None = None
    passed: bool | None = None
    feedback: str | None = None


class TestProgressEvent(BaseModel):
    """Server-to-client: test progress update."""

    invocation_id: str
    type: str
    run_id: str | None = None
    current_run: int | None = None
    total_runs: int | None = None
    message: str | None = None


class TestStoppedEvent(BaseModel):
    """Server-to-client: test execution stopped."""

    invocation_id: str
    success: bool = True
    message: str | None = None


class TestErrorEvent(BaseModel):
    """Server-to-client: test error."""

    invocation_id: str | None = None
    run_id: str | None = None
    message: str
    error_type: str | None = None


# ---------------------------------------------------------------------------
# Attempt state management
# ---------------------------------------------------------------------------


class AttemptStartPayload(BaseModel):
    """Client-to-server: create a new attempt."""

    training_entry_id: UUID
    infinite_mode: bool = False
    resource_types: list[str] | None = None
    user_instructions: list[str] | None = None
    save: bool = True


class AttemptNextPayload(BaseModel):
    """Client-to-server: proceed to the next scenario in an existing attempt."""

    attempt_id: UUID
    draft_id: UUID | None = None
    resource_types: list[str] | None = None
    user_instructions: list[str] | None = None
    save: bool = True


class AttemptStartedEvent(BaseModel):
    """Server-to-client: new attempt created."""

    attempt_id: str
    training_entry_id: str


class AttemptEndPayload(BaseModel):
    """Client-to-server: end a single chat within an attempt."""

    attempt_id: UUID
    chat_id: UUID
    grade: bool = True


class AttemptChatStartedEvent(BaseModel):
    """Server-to-client: new chat created within an attempt."""

    attempt_id: str
    chat_id: str


class AttemptChatEndedEvent(BaseModel):
    """Server-to-client: single chat ended."""

    chat_id: str
    is_attempt_finished: bool | None = None
    grade_id: str | None = None


class AttemptEndAllPayload(BaseModel):
    """Client-to-server: end all remaining chats in an attempt."""

    attempt_id: UUID


class AttemptEndedEvent(BaseModel):
    """Server-to-client: entire attempt ended (all scenarios complete)."""

    attempt_id: str
    success: bool
    all_scenarios_complete: bool = False
    message: str | None = None


class AttemptUsePreviousPayload(BaseModel):
    """Client-to-server: copy grades from a previous attempt's chats.

    previous_chat_map: {scenario_id: previous_chat_id}
    """

    attempt_id: UUID
    previous_chat_map: dict[str, str]


class AttemptErrorEvent(BaseModel):
    """Server-to-client: attempt error."""

    chat_id: str | None = None
    type: str | None = None
    message: str


# ---------------------------------------------------------------------------
# Attempt message events
# ---------------------------------------------------------------------------


class AttemptMessagePayload(BaseModel):
    """Client-to-server: send a message in an attempt chat."""

    attempt_id: UUID
    chat_id: UUID
    message: str
    voice_mode: bool = False
    upload_id: UUID | None = None
    resource_types: list[str] | None = None
    user_instructions: list[str] | None = None


class AttemptUserCompleteEvent(BaseModel):
    """Server-to-client: user message finalized."""

    chat_id: str
    message_id: str
    content: str
    created_at: str
    item_id: str | None = None


class AttemptAssistantStartEvent(BaseModel):
    """Server-to-client: assistant message generation starting."""

    chat_id: str
    message_id: str
    created_at: str


class AttemptAssistantProgressEvent(BaseModel):
    """Server-to-client: assistant generation progress."""

    chat_id: str
    content_type: str  # "delta" | "audio"
    content: str | None = None
    audio: Any | None = None


class AttemptAssistantCompleteEvent(BaseModel):
    """Server-to-client: assistant message generation complete."""

    chat_id: str
    message_id: str
    content: str | None = None


class AttemptAssistantHintsEvent(BaseModel):
    """Server-to-client: hints created during assistant generation."""

    chat_id: str
    hints: list[dict[str, Any]]


# ---------------------------------------------------------------------------
# Attempt grade events
# ---------------------------------------------------------------------------


class AttemptGradePayload(BaseModel):
    """Client-to-server: trigger grading for an attempt chat."""

    attempt_id: UUID
    chat_id: UUID | None = None
    resource_types: list[str] | None = None
    user_instructions: list[str] | None = None


class AttemptGradeStartEvent(BaseModel):
    """Server-to-client: grading began."""

    chat_id: str
    grade_id: str | None = None


class AttemptGradeProgressEvent(BaseModel):
    """Server-to-client: per-criterion grade result."""

    chat_id: str
    grade_id: str | None = None
    resource_type: str | None = None
    entry: dict[str, Any] | None = None


class AttemptGradeCompleteEvent(BaseModel):
    """Server-to-client: aggregate grade result."""

    chat_id: str
    grade_id: str | None = None


# ---------------------------------------------------------------------------
# Attempt stop events
# ---------------------------------------------------------------------------


class AttemptStopPayload(BaseModel):
    """Client-to-server: stop message generation."""

    chat_id: UUID


class AttemptStoppedEvent(BaseModel):
    """Server-to-client: message generation stopped."""

    chat_id: str
    success: bool
    message: str | None = None


# ---------------------------------------------------------------------------
# Attempt response events
# ---------------------------------------------------------------------------


class AttemptResponsePayload(BaseModel):
    """Client-to-server: submit a video question response."""

    chat_id: UUID
    question_id: UUID
    option_ids: list[UUID]


class AttemptResponseResultEvent(BaseModel):
    """Server-to-client: response submission result."""

    success: bool
    message: str | None = None
    is_correct: bool | None = None


# ---------------------------------------------------------------------------
# Audio events
# ---------------------------------------------------------------------------


class AttemptAudioStartPayload(BaseModel):
    """Client-to-server: start a voice session."""

    chat_id: UUID


class AttemptAudioStopPayload(BaseModel):
    """Client-to-server: stop a voice session."""

    chat_id: UUID


class AttemptUserStartEvent(BaseModel):
    """Server-to-client: user speech detected in voice mode."""

    chat_id: str
    item_id: str


class AttemptUserProgressEvent(BaseModel):
    """Server-to-client: user transcription progress (audio mode)."""

    chat_id: str
    item_id: str
    transcript: str


class AttemptUserDeltaEvent(BaseModel):
    """Server-to-client: voice transcription delta (deprecated alias)."""

    chat_id: str
    item_id: str
    transcript: str


class AttemptAudioReadyEvent(BaseModel):
    """Server-to-client: voice session is ready."""

    chat_id: str
    success: bool
    message: str | None = None


class AttemptAudioEndedEvent(BaseModel):
    """Server-to-client: voice session ended."""

    chat_id: str
    success: bool
    message: str | None = None


# ---------------------------------------------------------------------------
# Generation events (v5 generic — replaces per-artifact event types)
# ---------------------------------------------------------------------------


class GenerationProgressEvent(BaseModel):
    """Server-to-client: generation resource progress."""

    artifact_type: str
    group_id: str
    run_id: str
    completed_resources: int
    total_resources: int
    percentage: int
    last_completed_resource: str


class GenerationCompleteEvent(BaseModel):
    """Server-to-client: generation complete (all agents finished)."""

    artifact_type: str
    group_id: str
    run_id: str
    success: bool = True
    message: str = ""
    artifact_id: str | None = None


class GenerationSavedEvent(BaseModel):
    """Server-to-client: artifact persisted after generation."""

    artifact_type: str
    group_id: str
    run_id: str
    artifact_id: str | None = None


class GenerationErrorEvent(BaseModel):
    """Server-to-client: generation error."""

    artifact_type: str
    group_id: str | None = None
    resource_type: str | None = None
    resource_types: list[str] | None = None
    resource_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str
