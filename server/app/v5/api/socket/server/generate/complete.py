"""Server handler for generation complete events.

Listens to generation_channel(type=complete) and emits to client:
- {artifact_type}_generation_complete
"""

from typing import Any

from app.globals import get_internal_sio, sio
from app.v5.api.socket.client.types import GenerationCompleteEvent

internal_sio = get_internal_sio()


@internal_sio.on("generation_channel")  # type: ignore
async def generation_complete_server_handler(data: dict[str, Any]) -> None:
    """Route generation complete to clients as {artifact_type}_generation_complete."""
    if data.get("type") != "complete":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    artifact_type = data.get("artifact_type", "unknown")

    payload = GenerationCompleteEvent(
        artifact_type=artifact_type,
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id", ""),
        success=data.get("success", True),
        message=data.get("message", ""),
        artifact_id=data.get("artifact_id"),
    )

    await sio.emit(
        f"{artifact_type}_generation_complete",
        payload.model_dump(mode="json"),
        room=sid,
    )
