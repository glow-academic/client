"""Attempt use previous handler.

Handles: attempt_use_previous — bridge existing attempt_chats from a previous
attempt into the current attempt, then delegate to attempt_proceed.
"""

import uuid
from typing import Any

from app.infra.globals import get_internal_sio, get_pool, sio
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.routes.v5.socket.client.types import AttemptUsePreviousPayload
from app.routes.v5.socket.internal.attempt.types import (
    AttemptErrorData,
    AttemptProceedData,
)
from app.routes.v5.tools.entries.attempt_chat_bridge.create import (
    create_attempt_chat_bridge,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


async def _attempt_use_previous_impl(
    sid: str, data: AttemptUsePreviousPayload, session_id: uuid.UUID
) -> None:
    """Handle attempt_use_previous — bridge previous attempt_chats, then proceed."""
    try:
        attempt_id = uuid.UUID(str(data.attempt_id))

        pool = get_pool()
        async with pool.acquire() as conn:
            for (
                _chat_entry_id_str,
                attempt_chat_id_str,
            ) in data.previous_chat_map.items():
                if not attempt_chat_id_str:
                    continue
                try:
                    attempt_chat_id = uuid.UUID(attempt_chat_id_str)
                    await create_attempt_chat_bridge(
                        conn,
                        attempt_id=attempt_id,
                        attempt_chat_id=attempt_chat_id,
                        session_id=session_id,
                    )
                except Exception as e:
                    logger.warning(
                        f"Failed to bridge attempt_chat {attempt_chat_id_str}: {e}"
                    )
                    continue

        # Delegate to attempt_proceed — it will find the next unresolved chat
        await internal_sio.emit(
            "attempt_proceed",
            AttemptProceedData(
                sid=sid,
                attempt_id=str(attempt_id),
                group_id=str(data.group_id),
                force_proceed=False,
            ).model_dump(mode="json"),
        )

    except Exception as e:
        logger.exception(f"Error in attempt_use_previous: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="end",
                message=f"Failed to use previous grades: {e}",
            ).model_dump(mode="json"),
        )


@sio.event  # type: ignore
async def attempt_use_previous(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_use_previous event — bridge previous attempt_chats."""
    try:
        payload = AttemptUsePreviousPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="end",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
            )
            return

        session_id_str = await find_session_by_socket(sid)
        if not session_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="end",
                    message="Session not found. Please reconnect.",
                ).model_dump(mode="json"),
            )
            return

        await _attempt_use_previous_impl(sid, payload, uuid.UUID(session_id_str))

    except Exception as e:
        logger.exception(f"Invalid request in attempt_use_previous: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="end",
                message=f"Invalid request: {e}",
            ).model_dump(mode="json"),
        )
