"""Unified client payload types for v5 WebSocket generation.

Instead of per-artifact payload classes (GenerateAgentPayload, GenerateAuthPayload, …),
v5 uses a single GeneratePayload that carries the artifact_type discriminator and a
generic artifact_id field. The registry maps these to the correct fetcher kwarg.
"""

from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

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

    sid: str = Field(..., description="Socket session identifier")
    profile_id: str | None = Field(..., description="UUID of the user profile")
    guest_id: str | None = Field(..., description="UUID of the guest user")
    server_time: float = Field(..., description="Server timestamp in epoch seconds")


# ---------------------------------------------------------------------------
# Attempt room management
# ---------------------------------------------------------------------------


class AttemptJoinPayload(BaseModel):
    """Client-to-server: join a chat room for real-time updates."""

    chat_id: UUID = Field(..., description="UUID of the chat to join")


class AttemptLeavePayload(BaseModel):
    """Client-to-server: leave a chat room."""

    chat_id: UUID = Field(..., description="UUID of the chat to leave")


class AttemptJoinedEvent(BaseModel):
    """Server-to-client: successfully joined a chat room."""

    chat_id: str = Field(..., description="UUID of the chat joined")
    success: bool = Field(..., description="Whether the join succeeded")


# ---------------------------------------------------------------------------
# Test room management
# ---------------------------------------------------------------------------


class TestJoinPayload(BaseModel):
    """Client-to-server: join a test room for real-time updates."""

    invocation_id: UUID = Field(..., description="UUID of the test invocation to join")


class TestLeavePayload(BaseModel):
    """Client-to-server: leave a test room."""

    invocation_id: UUID = Field(..., description="UUID of the test invocation to leave")


class TestStartPayload(BaseModel):
    """Client-to-server: create a new test."""

    benchmark_id: UUID = Field(..., description="UUID of the benchmark to test against")
    infinite_mode: bool = Field(False, description="Whether to run in infinite mode")


class TestNextPayload(BaseModel):
    """Client-to-server: find next pending run in an existing test."""

    test_id: UUID = Field(..., description="UUID of the test")


class TestRunPayload(BaseModel):
    """Client-to-server: run one replay against an original run."""

    test_id: UUID = Field(..., description="UUID of the test")
    test_invocation_id: UUID = Field(..., description="UUID of the test invocation")
    run_id: UUID = Field(..., description="Original run to replay")


class TestGroupPayload(BaseModel):
    """Client-to-server: run all runs in a group sequentially."""

    test_id: UUID = Field(..., description="UUID of the test")
    test_invocation_id: UUID = Field(..., description="UUID of the test invocation")
    prev_run_id: UUID | None = Field(None, description="Previous run ID; None starts from first run")


class TestEndPayload(BaseModel):
    """Client-to-server: end a single invocation within a test."""

    test_id: UUID = Field(..., description="UUID of the test")
    test_invocation_id: UUID = Field(..., description="UUID of the test invocation")
    run_id: UUID = Field(..., description="UUID of the completed run for grading")
    grade: bool = Field(True, description="Whether to grade this run")


class TestEndAllPayload(BaseModel):
    """Client-to-server: end all remaining invocations in a test."""

    test_id: UUID = Field(..., description="UUID of the test")


class TestStopPayload(BaseModel):
    """Client-to-server: stop current test execution."""

    invocation_id: UUID = Field(..., description="UUID of the test invocation to stop")


class TestJoinedEvent(BaseModel):
    """Server-to-client: successfully joined a test room."""

    invocation_id: str = Field(..., description="UUID of the test invocation")
    success: bool = Field(True, description="Whether the join succeeded")


class TestStartedEvent(BaseModel):
    """Server-to-client: test created."""

    test_id: str = Field(..., description="UUID of the created test")


class TestRunStartEvent(BaseModel):
    """Server-to-client: run replay started."""

    invocation_id: str = Field(..., description="UUID of the test invocation")
    run_id: str = Field(..., description="UUID of the test run")
    original_run_resource_id: str | None = Field(None, description="Resource ID of the original run")
    current_run: int = Field(..., description="Current run index (1-based)")
    total_runs: int = Field(..., description="Total number of runs in this invocation")
    created_at: str = Field(..., description="ISO 8601 timestamp of run creation")


class TestRunDeltaEvent(BaseModel):
    """Server-to-client: generation progress delta."""

    invocation_id: str = Field(..., description="UUID of the test invocation")
    run_id: str = Field(..., description="UUID of the test run")
    content: str = Field(..., description="Incremental text update")


class TestRunCompleteEvent(BaseModel):
    """Server-to-client: single run replay completed."""

    invocation_id: str = Field(..., description="UUID of the test invocation")
    run_id: str = Field(..., description="UUID of the test run")
    original_run_resource_id: str | None = Field(None, description="Resource ID of the original run")
    tool_calls: list[dict[str, Any]] | None = Field(None, description="Tool calls made during the run")
    current_run: int = Field(..., description="Current run index (1-based)")
    total_runs: int = Field(..., description="Total number of runs in this invocation")
    remaining_runs: int = Field(..., description="Number of runs still pending")


class TestAllCompleteEvent(BaseModel):
    """Server-to-client: all runs complete."""

    invocation_id: str = Field(..., description="UUID of the test invocation")
    total_runs: int = Field(..., description="Total number of completed runs")
    success: bool = Field(True, description="Whether all runs succeeded")


class TestGradedEvent(BaseModel):
    """Server-to-client: grading completed."""

    invocation_id: str = Field(..., description="UUID of the test invocation")
    grade_id: str | None = Field(None, description="UUID of the grade record")
    score: float | None = Field(None, description="Numeric grade score")
    passed: bool | None = Field(None, description="Whether the test passed")
    feedback: str | None = Field(None, description="Grading feedback text")


class TestProgressEvent(BaseModel):
    """Server-to-client: test progress update."""

    invocation_id: str = Field(..., description="UUID of the test invocation")
    type: str = Field(..., description="Progress event type")
    run_id: str | None = Field(None, description="UUID of the test run")
    current_run: int | None = Field(None, description="Current run index (1-based)")
    total_runs: int | None = Field(None, description="Total number of runs")
    message: str | None = Field(None, description="Event message content")


class TestStoppedEvent(BaseModel):
    """Server-to-client: test execution stopped."""

    invocation_id: str = Field(..., description="UUID of the test invocation")
    success: bool = Field(True, description="Whether the stop succeeded")
    message: str | None = Field(None, description="Event message content")


class TestErrorEvent(BaseModel):
    """Server-to-client: test error."""

    invocation_id: str | None = Field(None, description="UUID of the test invocation")
    run_id: str | None = Field(None, description="UUID of the test run")
    message: str = Field(..., description="Error message")
    error_type: str | None = Field(None, description="Classification of the error")


# ---------------------------------------------------------------------------
# Attempt state management
# ---------------------------------------------------------------------------


class AttemptStartPayload(BaseModel):
    """Client-to-server: create a new attempt."""

    home_id: UUID | None = Field(None, description="UUID of the home resource")
    practice_id: UUID | None = Field(None, description="UUID of the practice resource")
    infinite_mode: bool = Field(False, description="Whether to run in infinite mode")

    @model_validator(mode="after")
    def _exactly_one_parent(self) -> "AttemptStartPayload":
        if not self.home_id and not self.practice_id:
            raise ValueError("Either home_id or practice_id must be provided")
        if self.home_id and self.practice_id:
            raise ValueError("Only one of home_id or practice_id can be provided")
        return self


class AttemptNextPayload(BaseModel):
    """Client-to-server: proceed to the next scenario in an existing attempt."""

    attempt_id: UUID = Field(..., description="UUID of the attempt")
    draft_id: UUID | None = Field(None, description="UUID of the draft to use")


class AttemptStartedEvent(BaseModel):
    """Server-to-client: new attempt created."""

    attempt_id: str = Field(..., description="UUID of the attempt")
    chat_entry_id: str = Field(..., description="UUID of the initial chat entry")


class AttemptEndPayload(BaseModel):
    """Client-to-server: end a single chat within an attempt."""

    attempt_id: UUID = Field(..., description="UUID of the attempt")
    chat_id: UUID = Field(..., description="UUID of the chat to end")
    grade: bool = Field(True, description="Whether to grade this chat")


class AttemptChatStartedEvent(BaseModel):
    """Server-to-client: new chat created within an attempt."""

    attempt_id: str = Field(..., description="UUID of the attempt")
    chat_id: str = Field(..., description="UUID of the new chat")


class AttemptChatEndedEvent(BaseModel):
    """Server-to-client: single chat ended."""

    chat_id: str = Field(..., description="UUID of the ended chat")
    is_attempt_finished: bool | None = Field(None, description="Whether the entire attempt is finished")
    grade_id: str | None = Field(None, description="UUID of the grade record")


class AttemptEndAllPayload(BaseModel):
    """Client-to-server: end all remaining chats in an attempt."""

    attempt_id: UUID = Field(..., description="UUID of the attempt")


class AttemptEndedEvent(BaseModel):
    """Server-to-client: entire attempt ended (all scenarios complete)."""

    attempt_id: str = Field(..., description="UUID of the attempt")
    success: bool = Field(..., description="Whether the attempt ended successfully")
    all_scenarios_complete: bool = Field(False, description="Whether all scenarios are complete")
    message: str | None = Field(None, description="Event message content")


class AttemptUsePreviousPayload(BaseModel):
    """Client-to-server: reuse attempt_chats from a previous attempt.

    previous_chat_map: {chat_entry_id: attempt_chat_id}
    """

    attempt_id: UUID = Field(..., description="UUID of the attempt")
    previous_chat_map: dict[str, str] = Field(..., description="Map of chat_entry_id to attempt_chat_id")


class AttemptErrorEvent(BaseModel):
    """Server-to-client: attempt error."""

    chat_id: str | None = Field(None, description="UUID of the related chat")
    type: str | None = Field(None, description="Classification of the error")
    message: str = Field(..., description="Error message")


# ---------------------------------------------------------------------------
# Attempt message events
# ---------------------------------------------------------------------------


class AttemptMessagePayload(BaseModel):
    """Client-to-server: send a text message in an attempt chat (modality=call)."""

    attempt_id: UUID = Field(..., description="UUID of the attempt")
    chat_id: UUID = Field(..., description="UUID of the chat")
    message: str = Field(..., description="Text message content")
    parent_message_id: UUID | None = Field(None, description="UUID of the parent message for threading")


class AttemptUserCompleteEvent(BaseModel):
    """Server-to-client: user message finalized."""

    chat_id: str = Field(..., description="UUID of the chat")
    message_id: str = Field(..., description="UUID of the message")
    content: str = Field(..., description="Final message content")
    created_at: str = Field(..., description="ISO 8601 timestamp of message creation")
    item_id: str | None = Field(None, description="Audio VAD item identifier")


class AttemptAssistantStartEvent(BaseModel):
    """Server-to-client: assistant message generation starting."""

    chat_id: str = Field(..., description="UUID of the chat")
    message_id: str = Field(..., description="UUID of the assistant message")
    created_at: str = Field(..., description="ISO 8601 timestamp of generation start")


class AttemptAssistantProgressEvent(BaseModel):
    """Server-to-client: assistant generation progress."""

    chat_id: str = Field(..., description="UUID of the chat")
    content_type: str = Field(..., description="Content type: 'delta' or 'audio'")
    content: str | None = Field(None, description="Text content delta")
    audio: Any | None = Field(None, description="Audio content payload")


class AttemptAssistantCompleteEvent(BaseModel):
    """Server-to-client: assistant message generation complete."""

    chat_id: str = Field(..., description="UUID of the chat")
    message_id: str = Field(..., description="UUID of the assistant message")
    content: str | None = Field(None, description="Final assistant message content")


class AttemptAssistantHintsEvent(BaseModel):
    """Server-to-client: hints created during assistant generation."""

    chat_id: str = Field(..., description="UUID of the chat")
    hints: list[dict[str, Any]] = Field(..., description="List of hint objects")


# ---------------------------------------------------------------------------
# Attempt grade events
# ---------------------------------------------------------------------------


class AttemptGradePayload(BaseModel):
    """Client-to-server: trigger grading for an attempt chat."""

    attempt_id: UUID = Field(..., description="UUID of the attempt")
    chat_id: UUID | None = Field(None, description="UUID of the chat to grade")
    resource_types: list[str] | None = Field(None, description="Resource types to grade")
    user_instructions: list[str] | None = Field(None, description="Custom grading instructions")


class AttemptGradeStartEvent(BaseModel):
    """Server-to-client: grading began."""

    chat_id: str = Field(..., description="UUID of the chat being graded")
    grade_id: str | None = Field(None, description="UUID of the grade record")


class AttemptGradeProgressEvent(BaseModel):
    """Server-to-client: per-criterion grade result."""

    chat_id: str = Field(..., description="UUID of the chat being graded")
    grade_id: str | None = Field(None, description="UUID of the grade record")
    resource_type: str | None = Field(None, description="Type of resource being graded")
    entry: dict[str, Any] | None = Field(None, description="Grade criterion entry data")


class AttemptGradeCompleteEvent(BaseModel):
    """Server-to-client: aggregate grade result."""

    chat_id: str = Field(..., description="UUID of the graded chat")
    grade_id: str | None = Field(None, description="UUID of the grade record")


# ---------------------------------------------------------------------------
# Attempt stop events
# ---------------------------------------------------------------------------


class AttemptStopPayload(BaseModel):
    """Client-to-server: stop message generation."""

    chat_id: UUID = Field(..., description="UUID of the chat to stop generating")


class AttemptStoppedEvent(BaseModel):
    """Server-to-client: message generation stopped."""

    chat_id: str = Field(..., description="UUID of the chat")
    success: bool = Field(..., description="Whether the stop succeeded")
    message: str | None = Field(None, description="Event message content")


# ---------------------------------------------------------------------------
# Attempt response events
# ---------------------------------------------------------------------------


class AttemptResponsePayload(BaseModel):
    """Client-to-server: submit a video question response."""

    chat_id: UUID = Field(..., description="UUID of the chat")
    question_id: UUID = Field(..., description="UUID of the question being answered")
    option_ids: list[UUID] = Field(..., description="List of selected option UUIDs")


class AttemptResponseResultEvent(BaseModel):
    """Server-to-client: response submission result."""

    success: bool = Field(..., description="Whether the response was submitted")
    message: str | None = Field(None, description="Event message content")
    is_correct: bool | None = Field(None, description="Whether the response was correct")
    response_id: str | None = Field(None, description="UUID of the saved response")


# ---------------------------------------------------------------------------
# Audio events
# ---------------------------------------------------------------------------


class AttemptAudioStartPayload(BaseModel):
    """Client-to-server: start a voice session."""

    chat_id: UUID = Field(..., description="UUID of the chat for voice session")


class AttemptAudioStopPayload(BaseModel):
    """Client-to-server: stop a voice session."""

    chat_id: UUID = Field(..., description="UUID of the chat for voice session")


class AttemptUserStartEvent(BaseModel):
    """Server-to-client: user message started (text or audio)."""

    chat_id: str = Field(..., description="UUID of the chat")
    message_id: str = Field(..., description="UUID of the user message")
    created_at: str = Field(..., description="ISO 8601 timestamp of message creation")
    item_id: str | None = Field(None, description="Audio VAD item identifier")


class AttemptUserProgressEvent(BaseModel):
    """Server-to-client: user transcription progress (audio only)."""

    chat_id: str = Field(..., description="UUID of the chat")
    item_id: str | None = Field(None, description="Audio VAD item identifier")
    transcript: str = Field(..., description="Current transcription text")


class AttemptUserDeltaEvent(BaseModel):
    """Server-to-client: voice transcription delta (deprecated alias)."""

    chat_id: str = Field(..., description="UUID of the chat")
    item_id: str = Field(..., description="Audio VAD item identifier")
    transcript: str = Field(..., description="Incremental transcription delta")


class AttemptAudioReadyEvent(BaseModel):
    """Server-to-client: voice session is ready."""

    chat_id: str = Field(..., description="UUID of the chat")
    success: bool = Field(..., description="Whether the voice session is ready")
    message: str | None = Field(None, description="Event message content")


class AttemptAudioEndedEvent(BaseModel):
    """Server-to-client: voice session ended."""

    chat_id: str = Field(..., description="UUID of the chat")
    success: bool = Field(..., description="Whether the voice session ended cleanly")
    message: str | None = Field(None, description="Event message content")


# ---------------------------------------------------------------------------
# Generation events (v5 generic — replaces per-artifact event types)
# ---------------------------------------------------------------------------


class GenerationProgressEvent(BaseModel):
    """Server-to-client: generation resource progress."""

    artifact_type: str = Field(..., description="Type of artifact being generated")
    group_id: str = Field(..., description="UUID of the generation group")
    run_id: str = Field(..., description="UUID of the generation run")
    completed_resources: int = Field(..., description="Number of resources completed so far")
    total_resources: int = Field(..., description="Total number of resources to generate")
    percentage: int = Field(..., description="Progress percentage (0-100)")
    last_completed_resource: str = Field(..., description="Name of the last completed resource")


class GenerationCompleteEvent(BaseModel):
    """Server-to-client: generation complete (all agents finished)."""

    artifact_type: str = Field(..., description="Type of artifact generated")
    group_id: str = Field(..., description="UUID of the generation group")
    run_id: str = Field(..., description="UUID of the generation run")
    success: bool = Field(True, description="Whether generation succeeded")
    message: str = Field("", description="Completion message")
    artifact_id: str | None = Field(None, description="UUID of the generated artifact")


class GenerationSavedEvent(BaseModel):
    """Server-to-client: artifact persisted after generation."""

    artifact_type: str = Field(..., description="Type of artifact saved")
    group_id: str = Field(..., description="UUID of the generation group")
    run_id: str = Field(..., description="UUID of the generation run")
    artifact_id: str | None = Field(None, description="UUID of the saved artifact")


class GenerationErrorEvent(BaseModel):
    """Server-to-client: generation error."""

    artifact_type: str = Field(..., description="Type of artifact that failed")
    group_id: str | None = Field(None, description="UUID of the generation group")
    resource_type: str | None = Field(None, description="Type of resource that failed")
    resource_types: list[str] | None = Field(None, description="List of resource types that failed")
    resource_id: str | None = Field(None, description="UUID of the failed resource")
    run_id: str | None = Field(None, description="UUID of the generation run")
    success: bool = Field(False, description="Always False for error events")
    message: str = Field(..., description="Error message")


class GenerationMediaProgressEvent(BaseModel):
    """Server-to-client: media generation progress (image/video)."""

    modality: str = Field(..., description="Media modality: 'image' or 'video'")
    artifact_type: str = Field(..., description="Type of artifact being generated")
    group_id: str | None = Field(None, description="UUID of the generation group")
    run_id: str | None = Field(None, description="UUID of the generation run")
    resource_type: str | None = Field(None, description="Type of resource being generated")
    resource_id: str | None = Field(None, description="UUID of the resource")
    status: str = Field(..., description="Current status: 'started' or 'in_progress'")
    message: str = Field(..., description="Progress message")


class GenerationMediaCompleteEvent(BaseModel):
    """Server-to-client: media generation complete (image/video)."""

    modality: str = Field(..., description="Media modality: 'image' or 'video'")
    artifact_type: str = Field(..., description="Type of artifact generated")
    group_id: str | None = Field(None, description="UUID of the generation group")
    run_id: str | None = Field(None, description="UUID of the generation run")
    resource_type: str | None = Field(None, description="Type of resource generated")
    resource_id: str | None = Field(None, description="UUID of the resource")
    file_path: str | None = Field(None, description="Path to the generated media file")
    mime_type: str | None = Field(None, description="MIME type of the media file")
    file_size: int | None = Field(None, description="File size in bytes")
    upload_id: str | None = Field(None, description="UUID of the upload record")
