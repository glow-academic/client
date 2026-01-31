"""Simulation attempt progress handler - listens to generate_text_* events and emits attempt-specific events."""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio
from app.socket.v4.attempts.simulation.types import AttemptProgressEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/attempt/progress", response_model=dict[str, bool])
async def attempt_progress_api(request: AttemptProgressEvent) -> dict[str, bool]:
    """Server-to-client event: Attempt generation progress (token streaming)."""
    return {"success": True}


@internal_sio.on("generate_text_start")  # type: ignore
@internal_sio.on("generate_text_progress")  # type: ignore
async def handle_attempt_progress(data: dict[str, Any]) -> None:
    """Handle generate_text_* events - filter by attempt artifact_type and emit attempt-specific event."""
    artifact_type = data.get("artifact_type")
    if artifact_type != "attempt":
        return  # Not for us

    sid = data.get("sid", "")
    if not sid:
        return  # No socket ID, can't emit to client

    # Get profile_id from sid to verify connection
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    event_type = data.get("event_type")
    chat_id = data.get("chat_id")
    message_id = data.get("message_id")

    if event_type == "text_start" and message_id:
        # Emit attempt_started event (already emitted in generate.py, but also here for consistency)
        await sio.emit(
            "attempt_progress",
            AttemptProgressEvent(
                artifact_type="attempt",
                chat_id=chat_id,
                message_id=message_id,
                run_id=data.get("run_id"),
                group_id=data.get("group_id"),
                modality="text",
                type="start",
                event_type="text_start",
            ).model_dump(mode="json"),
            room=sid,
        )
    elif event_type == "text_delta" and message_id:
        # Emit token delta
        await sio.emit(
            "attempt_progress",
            AttemptProgressEvent(
                artifact_type="attempt",
                chat_id=chat_id,
                message_id=message_id,
                delta=data.get("delta", ""),
                accumulated_content=data.get("accumulated_content", ""),
                run_id=data.get("run_id"),
                group_id=data.get("group_id"),
                modality="text",
                type="progress",
                event_type="text_delta",
            ).model_dump(mode="json"),
            room=sid,
        )
