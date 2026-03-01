"""Server-to-client OpenAPI routes for v5 WebSocket events.

These dummy FastAPI endpoints exist solely to generate OpenAPI schema entries
that the TypeScript client uses for strongly-typed socket event payloads.

Resource and entry generation events are handled by the dynamic loops in
resources/__init__.py and entries/__init__.py respectively.
"""

from fastapi import APIRouter

from app.socket.v5.client.types import (
    AttemptAssistantCompleteEvent,
    AttemptAssistantHintsEvent,
    AttemptAssistantProgressEvent,
    AttemptAssistantStartEvent,
    AttemptAudioEndedEvent,
    AttemptAudioReadyEvent,
    AttemptChatEndedEvent,
    AttemptChatStartedEvent,
    AttemptEndedEvent,
    AttemptErrorEvent,
    AttemptGradeCompleteEvent,
    AttemptGradeProgressEvent,
    AttemptJoinedEvent,
    AttemptResponseResultEvent,
    AttemptStartedEvent,
    AttemptStoppedEvent,
    AttemptUserCompleteEvent,
    AttemptUserDeltaEvent,
    AttemptUserStartEvent,
    ConnectionConfirmedPayload,
    GenerationCompleteEvent,
    GenerationErrorEvent,
    GenerationProgressEvent,
    GenerationSavedEvent,
    TestErrorEvent,
    TestGradedEvent,
    TestJoinedEvent,
    TestProgressEvent,
    TestRunCompleteEvent,
    TestRunStartEvent,
    TestStartedEvent,
    TestStoppedEvent,
)

server_router = APIRouter()

# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------


@server_router.post("/connection_confirmed")
async def connection_confirmed_api(
    request: ConnectionConfirmedPayload,
) -> dict[str, bool]:
    """Server-to-client: connection confirmed."""
    return {"success": True}


# ---------------------------------------------------------------------------
# Attempt events
# ---------------------------------------------------------------------------


@server_router.post("/attempt/started")
async def attempt_started_api(request: AttemptStartedEvent) -> dict[str, bool]:
    """Server-to-client: new attempt created."""
    return {"success": True}


@server_router.post("/attempt/chat_started")
async def attempt_chat_started_api(
    request: AttemptChatStartedEvent,
) -> dict[str, bool]:
    """Server-to-client: new chat created within an attempt."""
    return {"success": True}


@server_router.post("/attempt/chat_ended")
async def attempt_chat_ended_api(request: AttemptChatEndedEvent) -> dict[str, bool]:
    """Server-to-client: single chat ended."""
    return {"success": True}


@server_router.post("/attempt/ended")
async def attempt_ended_api(request: AttemptEndedEvent) -> dict[str, bool]:
    """Server-to-client: entire attempt ended."""
    return {"success": True}


@server_router.post("/attempt/error")
async def attempt_error_api(request: AttemptErrorEvent) -> dict[str, bool]:
    """Server-to-client: attempt error."""
    return {"success": True}


@server_router.post("/attempt/graded")
async def attempt_graded_api(request: AttemptGradeCompleteEvent) -> dict[str, bool]:
    """Server-to-client: aggregate grade result."""
    return {"success": True}


@server_router.post("/attempt/joined")
async def attempt_joined_api(request: AttemptJoinedEvent) -> dict[str, bool]:
    """Server-to-client: successfully joined a chat room."""
    return {"success": True}


@server_router.post("/attempt/stopped")
async def attempt_stopped_api(request: AttemptStoppedEvent) -> dict[str, bool]:
    """Server-to-client: message generation stopped."""
    return {"success": True}


@server_router.post("/attempt/response_result")
async def attempt_response_result_api(
    request: AttemptResponseResultEvent,
) -> dict[str, bool]:
    """Server-to-client: response submission result."""
    return {"success": True}


@server_router.post("/attempt/assistant_start")
async def attempt_assistant_start_api(
    request: AttemptAssistantStartEvent,
) -> dict[str, bool]:
    """Server-to-client: assistant message generation starting."""
    return {"success": True}


@server_router.post("/attempt/assistant_complete")
async def attempt_assistant_complete_api(
    request: AttemptAssistantCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client: assistant message generation complete."""
    return {"success": True}


@server_router.post("/attempt/progress")
async def attempt_progress_api(
    request: AttemptAssistantProgressEvent,
) -> dict[str, bool]:
    """Server-to-client: assistant generation progress."""
    return {"success": True}


@server_router.post("/attempt/assistant_audio")
async def attempt_assistant_audio_api(
    request: AttemptAssistantProgressEvent,
) -> dict[str, bool]:
    """Server-to-client: assistant audio chunk."""
    return {"success": True}


@server_router.post("/attempt/user_start")
async def attempt_user_start_api(request: AttemptUserStartEvent) -> dict[str, bool]:
    """Server-to-client: user speech detected in voice mode."""
    return {"success": True}


@server_router.post("/attempt/user_complete")
async def attempt_user_complete_api(
    request: AttemptUserCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client: user message finalized."""
    return {"success": True}


@server_router.post("/attempt/user_delta")
async def attempt_user_delta_api(request: AttemptUserDeltaEvent) -> dict[str, bool]:
    """Server-to-client: voice transcription delta."""
    return {"success": True}


@server_router.post("/attempt/audio_ready")
async def attempt_audio_ready_api(request: AttemptAudioReadyEvent) -> dict[str, bool]:
    """Server-to-client: voice session is ready."""
    return {"success": True}


@server_router.post("/attempt/audio_ended")
async def attempt_audio_ended_api(request: AttemptAudioEndedEvent) -> dict[str, bool]:
    """Server-to-client: voice session ended."""
    return {"success": True}


@server_router.post("/attempt/content_progress")
async def attempt_content_progress_api(
    request: AttemptGradeProgressEvent,
) -> dict[str, bool]:
    """Server-to-client: per-criterion grade result (content)."""
    return {"success": True}


@server_router.post("/attempt/hint_progress")
async def attempt_hint_progress_api(
    request: AttemptAssistantHintsEvent,
) -> dict[str, bool]:
    """Server-to-client: hints created during assistant generation."""
    return {"success": True}


@server_router.post("/attempt/grading_progress")
async def attempt_grading_progress_api(
    request: AttemptGradeProgressEvent,
) -> dict[str, bool]:
    """Server-to-client: per-criterion grade result (grading)."""
    return {"success": True}


# ---------------------------------------------------------------------------
# Test events
# ---------------------------------------------------------------------------


@server_router.post("/test/started")
async def test_started_api(request: TestStartedEvent) -> dict[str, bool]:
    """Server-to-client: test created."""
    return {"success": True}


@server_router.post("/test/joined")
async def test_joined_api(request: TestJoinedEvent) -> dict[str, bool]:
    """Server-to-client: successfully joined a test room."""
    return {"success": True}


@server_router.post("/test/run_start")
async def test_run_start_api(request: TestRunStartEvent) -> dict[str, bool]:
    """Server-to-client: run replay started."""
    return {"success": True}


@server_router.post("/test/run_complete")
async def test_run_complete_api(request: TestRunCompleteEvent) -> dict[str, bool]:
    """Server-to-client: single run replay completed."""
    return {"success": True}


@server_router.post("/test/progress")
async def test_progress_api(request: TestProgressEvent) -> dict[str, bool]:
    """Server-to-client: test progress update."""
    return {"success": True}


@server_router.post("/test/graded")
async def test_graded_api(request: TestGradedEvent) -> dict[str, bool]:
    """Server-to-client: grading completed."""
    return {"success": True}


@server_router.post("/test/error")
async def test_error_api(request: TestErrorEvent) -> dict[str, bool]:
    """Server-to-client: test error."""
    return {"success": True}


@server_router.post("/test/stopped")
async def test_stopped_api(request: TestStoppedEvent) -> dict[str, bool]:
    """Server-to-client: test execution stopped."""
    return {"success": True}


# ---------------------------------------------------------------------------
# Generation events
# ---------------------------------------------------------------------------


@server_router.post("/generation_complete")
async def generation_complete_api(
    request: GenerationCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client: generation complete."""
    return {"success": True}


@server_router.post("/generation_error")
async def generation_error_api(request: GenerationErrorEvent) -> dict[str, bool]:
    """Server-to-client: generation error."""
    return {"success": True}


@server_router.post("/generation_progress")
async def generation_progress_api(
    request: GenerationProgressEvent,
) -> dict[str, bool]:
    """Server-to-client: generation resource progress."""
    return {"success": True}


@server_router.post("/generation_saved")
async def generation_saved_api(request: GenerationSavedEvent) -> dict[str, bool]:
    """Server-to-client: artifact persisted after generation."""
    return {"success": True}
