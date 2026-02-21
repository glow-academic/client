"""Server handler for generation_started events.

Listens to internal `generation_started` and emits to client:
- {artifact_type}_generation_started (passthrough)
"""

from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v5.internal.generation_types import GenerationStartedEvent

internal_sio = get_internal_sio()


@internal_sio.on("generation_started")  # type: ignore
async def generation_started_server_handler(data: dict[str, Any]) -> None:
    """Route generation_started to clients as {artifact_type}_generation_started."""
    sid = data.get("sid", "")
    if not sid:
        return

    artifact_type = data.get("artifact_type", "unknown")
    rooms = data.get("rooms") or [sid]

    payload = GenerationStartedEvent(
        artifact_type=artifact_type,
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id", ""),
        resource_types=data.get("resource_types", []),
    ).model_dump(mode="json")

    for room in rooms:
        await sio.emit(f"{artifact_type}_generation_started", payload, room=room)
