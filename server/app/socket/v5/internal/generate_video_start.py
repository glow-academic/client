"""Handle generate_video_start — video generation started.

Emits generation_channel(type=media_progress) so the client knows
a video is being generated for a resource.
"""

from typing import Any

from app.main import get_internal_sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("generate_video_start")  # type: ignore
async def handle_video_start(data: dict[str, Any]) -> None:
    """Emit media progress for video generation start."""
    sid = data.get("sid", "")
    if not sid:
        return

    await internal_sio.emit(
        "generation_channel",
        {
            "type": "media_progress",
            "sid": sid,
            "modality": "video",
            "artifact_type": data.get("artifact_type", ""),
            "group_id": data.get("group_id", ""),
            "run_id": data.get("run_id", ""),
            "resource_type": data.get("resource_type", ""),
            "resource_id": data.get("resource_id"),
            "status": "started",
            "message": "Video generation started",
            "metadata": data.get("metadata"),
        },
    )
