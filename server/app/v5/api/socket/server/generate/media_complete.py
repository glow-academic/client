"""Server handler for media generation complete events.

Listens to generation_channel(type=media_complete) and emits to client:
- {artifact_type}_generation_media_complete
"""

from typing import Any

from app.v5.infra.globals import get_internal_sio, sio
from app.v5.api.socket.client.types import GenerationMediaCompleteEvent

internal_sio = get_internal_sio()


@internal_sio.on("generation_channel")  # type: ignore
async def generation_media_complete_server_handler(data: dict[str, Any]) -> None:
    """Route media complete to clients as {artifact_type}_generation_media_complete."""
    if data.get("type") != "media_complete":
        return

    sid = data.get("sid", "")
    if not sid:
        return

    artifact_type = data.get("artifact_type", "unknown")

    payload = GenerationMediaCompleteEvent(
        modality=data.get("modality", ""),
        artifact_type=artifact_type,
        group_id=data.get("group_id"),
        run_id=data.get("run_id"),
        resource_type=data.get("resource_type"),
        resource_id=data.get("resource_id"),
        file_path=data.get("file_path"),
        mime_type=data.get("mime_type"),
        file_size=data.get("file_size"),
        upload_id=data.get("upload_id"),
    )

    await sio.emit(
        f"{artifact_type}_generation_media_complete",
        payload.model_dump(mode="json"),
        room=sid,
    )
