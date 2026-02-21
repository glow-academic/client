"""Internal attempt_grade handler.

Handles: @internal_sio.on("attempt_grade") — grading triggered by attempt_end.
Delegates to the shared _attempt_grade_impl in v5/client/attempt/grade.py.
"""

import uuid
from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio
from app.socket.v5.client.attempt.grade import _attempt_grade_impl
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("attempt_grade")  # type: ignore
async def attempt_grade_internal(data: dict[str, Any]) -> None:
    """Handle attempt_grade from internal bus (e.g. from attempt_end)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            return

        profile_id = uuid.UUID(profile_id_str)
        attempt_id = uuid.UUID(str(data["attempt_id"]))
        chat_id = uuid.UUID(str(data["chat_id"])) if data.get("chat_id") else None

        await _attempt_grade_impl(
            sid=sid,
            attempt_id=attempt_id,
            chat_id=chat_id,
            profile_id=profile_id,
        )

    except Exception as e:
        logger.exception(f"Error in attempt_grade_internal: {e}")
