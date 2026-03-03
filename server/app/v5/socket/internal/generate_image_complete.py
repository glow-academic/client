"""Handle generate_image_complete — image generation finalized.

Emits generation_channel(type=media_complete) with the file info
so the client can display the generated image.
"""

from typing import Any

from app.main import get_internal_sio
from app.v5.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("generate_image_complete")  # type: ignore
async def handle_image_complete(data: dict[str, Any]) -> None:
    """Emit media complete for image generation."""
    sid = data.get("sid", "")
    if not sid:
        return

    await internal_sio.emit(
        "generation_channel",
        {
            "type": "media_complete",
            "sid": sid,
            "modality": "image",
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
