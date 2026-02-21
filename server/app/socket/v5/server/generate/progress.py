"""Server handler for generation progress events.

Listens to generation_channel(type=progress) and emits to client:
- {artifact_type}_generation_progress
"""

from typing import Any

from app.main import get_internal_sio, sio
from app.socket.v5.client.types import GenerationProgressEvent

internal_sio = get_internal_sio()


@internal_sio.on("generation_channel")  # type: ignore
async def generation_progress_server_handler(data: dict[str, Any]) -> None:
    """Route generation progress to clients as {artifact_type}_generation_progress."""
    if data.get("type") != "progress":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    artifact_type = data.get("artifact_type", "unknown")

    payload = GenerationProgressEvent(
        artifact_type=artifact_type,
        group_id=data.get("group_id", ""),
        run_id=data.get("run_id", ""),
        completed_resources=data.get("completed_resources", 0),
        total_resources=data.get("total_resources", 0),
        percentage=data.get("percentage", 0),
        last_completed_resource=data.get("last_completed_resource", ""),
    )

    await sio.emit(
        f"{artifact_type}_generation_progress",
        payload.model_dump(mode="json"),
        room=sid,
    )
