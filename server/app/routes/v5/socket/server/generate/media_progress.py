"""Server handler for media generation progress events.

Listens to generation_channel(type=media_progress) and emits to client:
- {artifact_type}_generation_media_progress
"""

from typing import Any

from app.globals import get_internal_sio, sio
from app.routes.v5.socket.client.types import GenerationMediaProgressEvent

internal_sio = get_internal_sio()


@internal_sio.on("generation_channel")  # type: ignore
async def generation_media_progress_server_handler(data: dict[str, Any]) -> None:
    """Route media progress to clients as {artifact_type}_generation_media_progress."""
    if data.get("type") != "media_progress":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    artifact_type = data.get("artifact_type", "unknown")

    payload = GenerationMediaProgressEvent(
        modality=data.get("modality", ""),
        artifact_type=artifact_type,
        group_id=data.get("group_id"),
        run_id=data.get("run_id"),
        resource_type=data.get("resource_type"),
        resource_id=data.get("resource_id"),
        status=data.get("status", ""),
        message=data.get("message", ""),
    )

    await sio.emit(
        f"{artifact_type}_generation_media_progress",
        payload.model_dump(mode="json"),
        room=sid,
    )
