"""Test Feedback entry start handler."""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio, sio
from app.socket.v4.entries.test_feedback.types import TestFeedbackGenerationEvent
from app.socket.v4.entries.utils import resolve_entry_type

internal_sio = get_internal_sio()

server_router = APIRouter()


async def handle_start(data: dict[str, Any]) -> None:
    """Test Feedback generation started - emit typed event."""
    sid = data.get("sid", "")
    if not sid:
        return

    event = TestFeedbackGenerationEvent(
        artifact_type=data.get("artifact_type", ""),
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
    )

    await sio.emit(
        "test_feedback_generation_started",
        event.model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# Internal SIO listener
# =============================================================================


@internal_sio.on("generate_call_start")  # type: ignore
async def test_feedback_call_start_listener(data: dict[str, Any]) -> None:
    """Listen for tool_call_start events targeting test_feedback."""
    if data.get("event_type") != "tool_call_start":
        return
    if resolve_entry_type(data) != "test_feedback":
        return
    await handle_start(data)


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/test_feedback_generation_started")
async def test_feedback_generation_started_api(
    request: TestFeedbackGenerationEvent,
) -> dict[str, bool]:
    """Server-to-client event: Test Feedback generation started."""
    return {"success": True}
