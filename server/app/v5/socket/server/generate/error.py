"""Server handler for generation error events.

Listens to generation_channel(type=error) and emits to client:
- {artifact_type}_generation_error
"""

from typing import Any

from app.globals import get_internal_sio, sio
from app.v5.socket.client.types import GenerationErrorEvent

internal_sio = get_internal_sio()


@internal_sio.on("generation_channel")  # type: ignore
async def generation_error_server_handler(data: dict[str, Any]) -> None:
    """Route generation errors to clients as {artifact_type}_generation_error."""
    if data.get("type") != "error":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    artifact_type = data.get("artifact_type", "unknown")

    payload = GenerationErrorEvent(
        artifact_type=artifact_type,
        group_id=data.get("group_id"),
        resource_type=data.get("resource_type"),
        resource_types=data.get("resource_types"),
        resource_id=data.get("resource_id"),
        run_id=data.get("run_id"),
        success=False,
        message=data.get("message", "An error occurred during generation"),
    )

    await sio.emit(
        f"{artifact_type}_generation_error",
        payload.model_dump(mode="json"),
        room=sid,
    )
