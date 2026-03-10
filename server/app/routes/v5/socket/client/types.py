"""Unified client payload types for v5 WebSocket generation.

Instead of per-artifact payload classes (GenerateAgentPayload, GenerateAuthPayload, …),
v5 uses a single GeneratePayload that carries the artifact_type discriminator and a
generic artifact_id field. The registry maps these to the correct fetcher kwarg.
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, model_validator

# Re-exported from infra — canonical location is app.infra.websocket.generation_types
from app.infra.websocket.generation_types import (
    ArtifactOperation as ArtifactOperation,
)
from app.infra.websocket.generation_types import (
    ArtifactTypeItem as ArtifactTypeItem,
)
from app.infra.websocket.generation_types import (
    EntryOperation as EntryOperation,
)
from app.infra.websocket.generation_types import (
    EntryTypeItem as EntryTypeItem,
)
from app.infra.websocket.generation_types import (
    GeneratePayload as GeneratePayload,
)
from app.infra.websocket.generation_types import (
    ResourceOperation as ResourceOperation,
)
from app.infra.websocket.generation_types import (
    ResourceTypeItem as ResourceTypeItem,
)

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
    """Client-to-server: create a new test."""

    benchmark_id: UUID
    infinite_mode: bool = False


class TestNextPayload(BaseModel):
    """Client-to-server: find next pending run in an existing test."""

    test_id: UUID


class TestRunPayload(BaseModel):
    """Client-to-server: run one replay against an original run."""

    test_id: UUID
    test_invocation_id: UUID
    run_id: UUID  # original run to replay (copy all messages except last assistant)


class TestGroupPayload(BaseModel):
    """Client-to-server: run all runs in a group sequentially."""

    test_id: UUID
    test_invocation_id: UUID
    prev_run_id: UUID | None = None  # None = start from first run


class TestEndPayload(BaseModel):
    """Client-to-server: end a single invocation within a test."""

    test_id: UUID
    test_invocation_id: UUID
    run_id: UUID  # the run that was just completed (for grading)
    grade: bool = True


class TestEndAllPayload(BaseModel):
    """Client-to-server: end all remaining invocations in a test."""

    test_id: UUID


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

    home_id: UUID | None = None
    practice_id: UUID | None = None
    infinite_mode: bool = False

    @model_validator(mode="after")
    def _exactly_one_parent(self) -> "AttemptStartPayload":
        if not self.home_id and not self.practice_id:
            raise ValueError("Either home_id or practice_id must be provided")
        if self.home_id and self.practice_id:
            raise ValueError("Only one of home_id or practice_id can be provided")
        return self


class AttemptNextPayload(BaseModel):
    """Client-to-server: proceed to the next scenario in an existing attempt."""

    attempt_id: UUID
    draft_id: UUID | None = None


class AttemptStartedEvent(BaseModel):
    """Server-to-client: new attempt created."""

    attempt_id: str
    chat_entry_id: str


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
    """Client-to-server: reuse attempt_chats from a previous attempt.

    previous_chat_map: {chat_entry_id: attempt_chat_id}
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
    """Client-to-server: send a text message in an attempt chat (modality=call)."""

    attempt_id: UUID
    chat_id: UUID
    message: str
    parent_message_id: UUID | None = None


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
    """Server-to-client: user message started (text or audio)."""

    chat_id: str
    message_id: str
    created_at: str
    item_id: str | None = None  # Audio only (VAD item)


class AttemptUserProgressEvent(BaseModel):
    """Server-to-client: user transcription progress (audio only)."""

    chat_id: str
    item_id: str | None = None
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


class GenerationMediaProgressEvent(BaseModel):
    """Server-to-client: media generation progress (image/video)."""

    modality: str  # "image" | "video"
    artifact_type: str
    group_id: str | None = None
    run_id: str | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    status: str  # "started" | "in_progress"
    message: str


class GenerationMediaCompleteEvent(BaseModel):
    """Server-to-client: media generation complete (image/video)."""

    modality: str  # "image" | "video"
    artifact_type: str
    group_id: str | None = None
    run_id: str | None = None
    resource_type: str | None = None
    resource_id: str | None = None
    file_path: str | None = None
    mime_type: str | None = None
    file_size: int | None = None
    upload_id: str | None = None
