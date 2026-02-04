"""Attempt simulation progress handler.

Listens to AI generation progress events and emits attempt-specific
progress updates to clients. Filters by artifact_type='attempt'.
"""

import json
from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.attempt.types import (
    AttemptAssistantDeltaEvent,
    AttemptProgressEvent,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()


@internal_sio.on("generate_call_start")  # type: ignore
@internal_sio.on("generate_call_progress")  # type: ignore
@internal_sio.on("generate_text_start")  # type: ignore
@internal_sio.on("generate_text_progress")  # type: ignore
async def handle_attempt_progress(data: dict[str, Any]) -> None:
    """Handle generate_*_progress events - filter by attempt artifact_type and emit attempt-specific event."""
    # Filter by artifact_type (early return for efficiency)
    artifact_type = data.get("artifact_type")
    if artifact_type != "attempt":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    # Verify profile still connected
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    # Build progress event
    event = AttemptProgressEvent(
        artifact_type="attempt",
        group_id=data.get("group_id"),
        resource_type=data.get("resource_type"),
        resource_id=data.get("resource_id"),
        run_id=data.get("run_id"),
        modality=data.get("modality", "text"),
        type=data.get("type", "progress"),
        event_type=data.get("event_type"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
        arguments=data.get("arguments"),
        arguments_delta=data.get("arguments_delta"),
        trace_id=data.get("trace_id"),
        # Attempt-specific fields
        chat_id=data.get("chat_id"),
        message_id=data.get("message_id"),
        delta=data.get("delta"),
        accumulated_content=data.get("accumulated_content"),
    )

    await sio.emit(
        "attempt_progress",
        event.model_dump(mode="json"),
        room=sid,
    )

    # Also emit the unified attempt_assistant_delta event for new contract
    chat_id = data.get("chat_id")
    message_id = data.get("message_id")
    accumulated_content = data.get("accumulated_content")

    if chat_id and message_id and accumulated_content is not None:
        delta_event = AttemptAssistantDeltaEvent(
            chat_id=str(chat_id),
            message_id=str(message_id),
            content=str(accumulated_content),
        )
        await sio.emit(
            "attempt_assistant_delta",
            delta_event.model_dump(mode="json"),
            room=sid,
        )
        # Also emit to attempt room for multi-tab sync
        await sio.emit(
            "attempt_assistant_delta",
            delta_event.model_dump(mode="json"),
            room=f"attempt_{chat_id}",
        )

    # Tool-driven assistant content (create_content) should also stream through assistant_delta
    if (
        data.get("event_type") == "tool_call_delta"
        and data.get("tool_name") == "create_content"
        and chat_id
        and message_id
    ):
        arguments_delta = data.get("arguments_delta")
        if isinstance(arguments_delta, str) and arguments_delta:
            content_value = None
            try:
                parsed = json.loads(arguments_delta)
                content_value = parsed.get("content")
            except json.JSONDecodeError:
                content_value = None

            if isinstance(content_value, str) and content_value:
                delta_event = AttemptAssistantDeltaEvent(
                    chat_id=str(chat_id),
                    message_id=str(message_id),
                    content=content_value,
                )
                await sio.emit(
                    "attempt_assistant_delta",
                    delta_event.model_dump(mode="json"),
                    room=sid,
                )
                await sio.emit(
                    "attempt_assistant_delta",
                    delta_event.model_dump(mode="json"),
                    room=f"attempt_{chat_id}",
                )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/attempt/progress", response_model=dict[str, bool])
async def attempt_progress_api(request: AttemptProgressEvent) -> dict[str, bool]:
    """Server-to-client event: Attempt generation progress update."""
    return {"success": True}


@server_router.post("/attempt/assistant_delta", response_model=dict[str, bool])
async def attempt_assistant_delta_api(
    request: AttemptAssistantDeltaEvent,
) -> dict[str, bool]:
    """Server-to-client event: Attempt assistant delta (streaming content)."""
    return {"success": True}
