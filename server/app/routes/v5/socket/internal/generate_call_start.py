"""Handle generate_call_start — tool call started.

Currently a placeholder. Future: could emit attempt-specific tool call
start events, track call state, etc.
"""

from typing import Any

from app.globals import get_internal_sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("generate_call_start")  # type: ignore
async def handle_call_start(data: dict[str, Any]) -> None:
    """Handle tool call started."""
    pass
