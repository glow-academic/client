"""Client-to-server OpenAPI routes for v5 WebSocket events.

These dummy FastAPI endpoints exist solely to generate OpenAPI schema entries
that the TypeScript client uses for strongly-typed socket payloads.
"""

from fastapi import APIRouter

from .types import (
    AttemptAudioStartPayload,
    AttemptAudioStopPayload,
    AttemptEndAllPayload,
    AttemptEndPayload,
    AttemptGradePayload,
    AttemptJoinPayload,
    AttemptLeavePayload,
    AttemptMessagePayload,
    AttemptNextPayload,
    AttemptResponsePayload,
    AttemptStartPayload,
    AttemptStopPayload,
    AttemptUsePreviousPayload,
    GeneratePayload,
    TestEndPayload,
    TestJoinPayload,
    TestLeavePayload,
    TestNextPayload,
    TestRunPayload,
    TestStartPayload,
    TestStopPayload,
)

client_router = APIRouter()

# ---------------------------------------------------------------------------
# Lifecycle
# ---------------------------------------------------------------------------


@client_router.post("/connect")
async def connect_api() -> dict[str, bool]:
    """Client-to-server lifecycle event: Establish WebSocket connection."""
    return {"success": True}


@client_router.post("/disconnect")
async def disconnect_api() -> dict[str, bool]:
    """Client-to-server lifecycle event: Close WebSocket connection."""
    return {"success": True}


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------


@client_router.post("/generate")
async def generate_api(request: GeneratePayload) -> dict[str, bool]:
    """Client-to-server: start unified draft generation."""
    return {"success": True}


# ---------------------------------------------------------------------------
# Attempt
# ---------------------------------------------------------------------------


@client_router.post("/attempt/start")
async def attempt_start_api(request: AttemptStartPayload) -> dict[str, bool]:
    """Client-to-server: create a new attempt."""
    return {"success": True}


@client_router.post("/attempt/next")
async def attempt_next_api(request: AttemptNextPayload) -> dict[str, bool]:
    """Client-to-server: proceed to the next scenario."""
    return {"success": True}


@client_router.post("/attempt/join")
async def attempt_join_api(request: AttemptJoinPayload) -> dict[str, bool]:
    """Client-to-server: join a chat room."""
    return {"success": True}


@client_router.post("/attempt/leave")
async def attempt_leave_api(request: AttemptLeavePayload) -> dict[str, bool]:
    """Client-to-server: leave a chat room."""
    return {"success": True}


@client_router.post("/attempt/end")
async def attempt_end_api(request: AttemptEndPayload) -> dict[str, bool]:
    """Client-to-server: end a single chat within an attempt."""
    return {"success": True}


@client_router.post("/attempt/end_all")
async def attempt_end_all_api(request: AttemptEndAllPayload) -> dict[str, bool]:
    """Client-to-server: end all remaining chats in an attempt."""
    return {"success": True}


@client_router.post("/attempt/stop")
async def attempt_stop_api(request: AttemptStopPayload) -> dict[str, bool]:
    """Client-to-server: stop message generation."""
    return {"success": True}


@client_router.post("/attempt/message")
async def attempt_message_api(request: AttemptMessagePayload) -> dict[str, bool]:
    """Client-to-server: send a message in an attempt chat."""
    return {"success": True}


@client_router.post("/attempt/grade")
async def attempt_grade_api(request: AttemptGradePayload) -> dict[str, bool]:
    """Client-to-server: trigger grading for an attempt chat."""
    return {"success": True}


@client_router.post("/attempt/response_submit")
async def attempt_response_submit_api(
    request: AttemptResponsePayload,
) -> dict[str, bool]:
    """Client-to-server: submit a video question response."""
    return {"success": True}


@client_router.post("/attempt/use_previous")
async def attempt_use_previous_api(
    request: AttemptUsePreviousPayload,
) -> dict[str, bool]:
    """Client-to-server: copy grades from a previous attempt's chats."""
    return {"success": True}


@client_router.post("/attempt/audio_start")
async def attempt_audio_start_api(
    request: AttemptAudioStartPayload,
) -> dict[str, bool]:
    """Client-to-server: start a voice session."""
    return {"success": True}


@client_router.post("/attempt/audio_stop")
async def attempt_audio_stop_api(
    request: AttemptAudioStopPayload,
) -> dict[str, bool]:
    """Client-to-server: stop a voice session."""
    return {"success": True}


# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------


@client_router.post("/test/start")
async def test_start_api(request: TestStartPayload) -> dict[str, bool]:
    """Client-to-server: create a new test."""
    return {"success": True}


@client_router.post("/test/next")
async def test_next_api(request: TestNextPayload) -> dict[str, bool]:
    """Client-to-server: find next pending run in an existing test."""
    return {"success": True}


@client_router.post("/test/run")
async def test_run_api(request: TestRunPayload) -> dict[str, bool]:
    """Client-to-server: run one auto-regressive replay."""
    return {"success": True}


@client_router.post("/test/end")
async def test_end_api(request: TestEndPayload) -> dict[str, bool]:
    """Client-to-server: end test (triggers grading)."""
    return {"success": True}


@client_router.post("/test/join")
async def test_join_api(request: TestJoinPayload) -> dict[str, bool]:
    """Client-to-server: join a test room."""
    return {"success": True}


@client_router.post("/test/leave")
async def test_leave_api(request: TestLeavePayload) -> dict[str, bool]:
    """Client-to-server: leave a test room."""
    return {"success": True}


@client_router.post("/test/stop")
async def test_stop_api(request: TestStopPayload) -> dict[str, bool]:
    """Client-to-server: stop current test execution."""
    return {"success": True}
