"""Handle generate_text_start — text generation started.

Currently a placeholder. Future: could create assistant message shell,
emit attempt_assistant_start for attempt artifacts, etc.
"""

from typing import Any

from app.main import get_internal_sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("generate_text_start")  # type: ignore
async def handle_text_start(data: dict[str, Any]) -> None:
    """Handle text generation started."""
    pass
