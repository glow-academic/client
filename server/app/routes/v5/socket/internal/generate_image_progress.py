"""Handle generate_image_progress — image generation progress update.

Currently a placeholder. Future: could emit polling/streaming progress
for image generation providers that support it.
"""

from typing import Any

from app.infra.globals import get_internal_sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("generate_image_progress")  # type: ignore
async def handle_image_progress(data: dict[str, Any]) -> None:
    """Handle image generation progress."""
    pass
