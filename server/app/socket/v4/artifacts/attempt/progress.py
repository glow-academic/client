"""Attempt simulation progress handler.

Listens to AI generation progress events and emits attempt-specific
progress updates to clients. Filters by artifact_type='attempt'.
"""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.attempt.run_store import get_run_context
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
        delta=data.get("delta"),
        accumulated_content=data.get("accumulated_content"),
    )

    await sio.emit(
        "attempt_progress",
        event.model_dump(mode="json"),
        room=sid,
    )

    # Also emit attempt_assistant_delta for client-side message streaming.
    # Only stream tool_call_delta — the actual displayable content comes from
    # tool calls whose entry_type is "contents" (e.g. create_content tool).
    # The model's direct text output is intermediate reasoning, not displayable.
    #
    # Tool argument names are resolved deterministically via run_store.tool_meta
    # (tool_name → entry_type + display_arg), populated at message prepare time
    # from the output schema. No hardcoded argument names.
    event_type = data.get("event_type")
    if event_type == "tool_call_delta":
        run_id = data.get("run_id")
        tool_name = data.get("tool_name")
        if run_id and tool_name:
            ctx = get_run_context(run_id)
            if ctx:
                meta = ctx.tool_meta.get(tool_name)
                # Only stream content for "contents" entry type (assistant messages).
                # "hints" entry type has its own streaming path.
                if meta and meta.entry_type == "contents" and meta.display_arg:
                    arguments = data.get("arguments")
                    if isinstance(arguments, dict):
                        content = arguments.get(meta.display_arg)
                        if content:
                            delta_event = AttemptAssistantDeltaEvent(
                                chat_id=ctx.chat_id,
                                message_id=ctx.message_id,
                                content=content,
                            )
                            await sio.emit(
                                "attempt_assistant_delta",
                                delta_event.model_dump(mode="json"),
                                room=sid,
                            )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/attempt/progress", response_model=dict[str, bool])
async def attempt_progress_api(request: AttemptProgressEvent) -> dict[str, bool]:
    """Server-to-client event: Attempt generation progress update."""
    return {"success": True}


@server_router.post("/attempt/assistant/delta", response_model=dict[str, bool])
async def attempt_assistant_delta_api(
    request: AttemptAssistantDeltaEvent,
) -> dict[str, bool]:
    """Server-to-client event: Streaming text delta for assistant message."""
    return {"success": True}
