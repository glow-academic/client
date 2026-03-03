"""Internal attempt_next handler — delegate to attempt_proceed.

Handles: @internal_sio.on("attempt_next")

Simply emits attempt_proceed with force_proceed=True.
The proceed handler resolves context, checks remaining, and handles everything.
"""

from typing import Any

from app.globals import get_internal_sio
from app.v5.api.socket.client.types import AttemptNextPayload
from app.v5.api.socket.internal.attempt.types import (
    AttemptErrorData,
    AttemptProceedData,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("attempt_next")  # type: ignore
async def attempt_next_handler(data: dict[str, Any]) -> None:
    """Handle attempt_next — delegate to attempt_proceed."""
    sid = data.get("sid", "")
    if not sid:
        return

    try:
        payload = AttemptNextPayload(**data)
    except Exception as e:
        logger.exception(f"Invalid attempt_next payload: {e}")
        return

    try:
        await internal_sio.emit(
            "attempt_proceed",
            AttemptProceedData(
                sid=sid,
                attempt_id=str(payload.attempt_id),
                draft_id=str(payload.draft_id) if payload.draft_id else None,
                force_proceed=True,
            ).model_dump(mode="json"),
        )

    except Exception as e:
        logger.exception(f"Error in attempt_next: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="next",
                message=f"Failed to continue attempt: {e}",
            ).model_dump(mode="json"),
        )
