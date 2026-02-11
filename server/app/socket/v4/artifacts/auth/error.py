"""Auth error handler - listens to generate_*_error events and emits auth-specific events."""

from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.auth.types import (
    AUTH_GENERATE_RESOURCE_TYPES,
    AuthGenerationErrorEvent,
)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# =============================================================================
# FastAPI endpoint for OpenAPI documentation
# =============================================================================


@server_router.post("/auth_generation_error")
async def auth_generation_error_api(
    request: AuthGenerationErrorEvent,
) -> dict[str, bool]:
    """Server-to-client event: Auth generation error.

    Emitted when auth resource generation fails.
    """
    return {"success": True}


@internal_sio.on("generate_call_error")  # type: ignore
async def handle_auth_error(data: dict[str, Any]) -> None:
    """Handle generate_*_error event - filter by auth artifact_type and emit auth-specific event."""
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
    resource_types = [
        rt
        for rt in (data.get("resource_types", []) or [])
        if rt in AUTH_GENERATE_RESOURCE_TYPES
    ]
    if resource_type and resource_type not in AUTH_GENERATE_RESOURCE_TYPES:
        resource_type = None

    error_message = data.get("error_message") or data.get(
        "message", "An error occurred during auth generation"
    )

    event = AuthGenerationErrorEvent(
        artifact_type="auth",
        group_id=data.get("group_id"),
        resource_type=resource_type,
        resource_types=resource_types if resource_types else None,
        resource_id=data.get("resource_id"),
        success=False,
        message=error_message,
        trace_id=data.get("trace_id"),
    )
    await sio.emit(
        "auth_generation_error",
        event.model_dump(mode="json"),
        room=sid,
    )
