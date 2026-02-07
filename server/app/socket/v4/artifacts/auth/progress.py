"""Auth progress handler - listens to generate_text_* events and emits auth-specific events."""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.auth.types import AuthGenerationProgressEvent

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/auth_generation_progress")
async def auth_generation_progress_api(
    request: AuthGenerationProgressEvent,
) -> dict[str, bool]:
    """Server-to-client event: Auth generation progress.

    Emitted during auth resource generation to show progress.
    """
    return {"success": True}


@internal_sio.on("generate_call_start")  # type: ignore
@internal_sio.on("generate_call_progress")  # type: ignore
@internal_sio.on("generate_text_start")  # type: ignore
@internal_sio.on("generate_text_progress")  # type: ignore
async def handle_auth_call_progress(data: dict[str, Any]) -> None:
    """Handle generate_call_* events - filter by auth artifact_type and emit auth-specific event."""
    artifact_type = data.get("artifact_type")
    if artifact_type != "auth":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    resource_type = data.get("resource_type")
    group_id_str = data.get("group_id")
    if not group_id_str or not resource_type:
        return

    event = AuthGenerationProgressEvent(
        artifact_type="auth",
        group_id=data.get("group_id"),
        resource_type=resource_type,
        resource_id=data.get("resource_id"),
        run_id=data.get("run_id"),
        modality="call",
        type=data.get("type", "progress"),
        event_type=data.get("event_type"),
        tool_call_id=data.get("tool_call_id"),
        tool_name=data.get("tool_name"),
        arguments=data.get("arguments"),
        arguments_delta=data.get("arguments_delta"),
        trace_id=data.get("trace_id"),
    )
    await sio.emit(
        "auth_generation_progress",
        event.model_dump(mode="json"),
        room=sid,
    )
