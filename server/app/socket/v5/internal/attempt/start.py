"""Internal attempt_start handler.

Handles: @internal_sio.on("attempt_start") — auto-proceed after chat completes.
Delegates to the shared _attempt_start_impl in v5/client/attempt/start.py.
"""

import uuid
from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio
from app.socket.v5.client.attempt.start import _attempt_start_impl
from app.socket.v5.client.types import AttemptStartPayload
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("attempt_start")  # type: ignore
async def attempt_start_internal(data: dict[str, Any]) -> None:
    """Handle attempt_start from internal bus (auto-proceed after chat completes)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = AttemptStartPayload(**data)
        await _attempt_start_impl(sid, payload, profile_id)

    except Exception as e:
        logger.exception(f"Error in attempt_start_internal: {e}")
