"""Handle generate_video_complete — video generation finalized.

Emits generation_channel(type=media_complete) with the file info
so the client can display the generated video.
"""

from typing import Any

from app.v5.infra.globals import get_internal_sio
from app.v5.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("generate_video_complete")  # type: ignore
async def handle_video_complete(data: dict[str, Any]) -> None:
    """Emit media complete for video generation."""
    sid = data.get("sid", "")
    if not sid:
        return

    await internal_sio.emit(
        "generation_channel",
        {
            "type": "media_complete",
            "sid": sid,
            "modality": "video",
            "artifact_type": data.get("artifact_type", ""),
            "group_id": data.get("group_id", ""),
            "run_id": data.get("run_id", ""),
            "resource_type": data.get("resource_type", ""),
            "resource_id": data.get("resource_id"),
            "file_path": data.get("file_path"),
            "mime_type": data.get("mime_type"),
            "file_size": data.get("file_size"),
            "upload_id": data.get("upload_id"),
            "metadata": data.get("metadata"),
        },
    )
