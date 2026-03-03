"""Server handler for generation saved events.

Listens to generation_channel(type=saved) and emits to client:
- {artifact_type}_generation_saved

Separate from complete — tells client the artifact was persisted with its new ID.
"""

from typing import Any

from app.globals import get_internal_sio, sio
from app.v5.api.socket.client.types import GenerationSavedEvent

internal_sio = get_internal_sio()


@internal_sio.on("generation_channel")  # type: ignore
async def generation_saved_server_handler(data: dict[str, Any]) -> None:
    """Route generation saved to clients as {artifact_type}_generation_saved."""
    if data.get("type") != "saved":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    artifact_type = data.get("artifact_type", "unknown")

    payload = GenerationSavedEvent(
        artifact_type=artifact_type,
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id", ""),
        artifact_id=data.get("artifact_id"),
    )

    await sio.emit(
        f"{artifact_type}_generation_saved",
        payload.model_dump(mode="json"),
        room=sid,
    )
