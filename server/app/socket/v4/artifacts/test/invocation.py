"""Test invocation lifecycle handler.

Bridge handler: receives post-grade signal, decides whether to proceed
to the next run. Mirrors attempt/chat.py pattern.

Handles test_invocation internal event:
- If SHOULD_PROCEED: emit test_start internally (NEXT mode, with test_id)
"""

from typing import Any

from fastapi import APIRouter

from app.main import get_internal_sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()

SHOULD_PROCEED = True


@internal_sio.on("test_invocation")  # type: ignore
async def test_invocation_handler(data: dict[str, Any]) -> None:
    """Handle test_invocation from internal bus.

    Receives: { sid, test_id, invocation_id }
    If SHOULD_PROCEED: emit test_start internally (NEXT mode).
    """
    sid = data.get("sid", "")
    if not sid:
        return

    test_id = data.get("test_id")
    invocation_id = data.get("invocation_id")

    if not test_id:
        logger.warning("test_invocation: missing test_id")
        return

    logger.info(
        f"Test invocation lifecycle - test_id={test_id}, invocation_id={invocation_id}"
    )

    if SHOULD_PROCEED:
        await internal_sio.emit(
            "test_start",
            {
                "sid": sid,
                "test_id": test_id,
            },
        )
