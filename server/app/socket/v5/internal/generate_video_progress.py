"""Handle generate_video_progress — video generation polling progress.

Emits generation_channel(type=media_progress) with polling status
so the client can show video generation progress.
"""

from typing import Any

from app.main import get_internal_sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("generate_video_progress")  # type: ignore
async def handle_video_progress(data: dict[str, Any]) -> None:
    """Emit media progress for video generation polling."""
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
            "status": "in_progress",
            "message": data.get("message", "Video generation in progress"),
            "metadata": data.get("metadata"),
        },
    )
