"""Attempt end all handler.

Handles: attempt_end_all — end all remaining chats in an attempt.

Delegates to attempt_proceed(complete_all=True), which marks all remaining
chats as completed and emits attempt_ended.
"""

import uuid
from typing import Any

from app.infra.globals import get_internal_sio, get_pool, get_redis_client, sio
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.routes.v5.socket.client.types import AttemptEndAllPayload
from app.routes.v5.socket.internal.attempt.types import (
    AttemptErrorData,
    AttemptProceedData,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


async def _attempt_end_all_impl(sid: str, data: AttemptEndAllPayload) -> None:
    """Handle attempt_end_all — delegate to attempt_proceed with complete_all."""
    try:
        attempt_id = str(data.attempt_id)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            raise ValueError("Profile not found for socket")

        session_id_str = await find_session_by_socket(sid)
        if not session_id_str:
            raise ValueError("Session not found for socket")

        identity = await resolve_profile_identity_context(
            get_pool(),
            uuid.UUID(profile_id_str),
            get_redis_client(),
            session_id=uuid.UUID(session_id_str),
            attempt_id=uuid.UUID(attempt_id),
        )
        group_id = identity.group_id if identity else None
        if group_id is None:
            raise ValueError(f"Group not found for attempt {attempt_id}")

        # Delegate to attempt_proceed with complete_all=True
        await internal_sio.emit(
            "attempt_proceed",
            AttemptProceedData(
                sid=sid,
                attempt_id=attempt_id,
                group_id=str(group_id),
                complete_all=True,
            ).model_dump(mode="json"),
        )

    except Exception as e:
        logger.exception(f"Error in attempt_end_all: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="end",
                message=f"Failed to end all chats: {e}",
            ).model_dump(mode="json"),
        )


@sio.event  # type: ignore
async def attempt_end_all(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_end_all event — end all chats in an attempt."""
    try:
        payload = AttemptEndAllPayload(**data)
        await _attempt_end_all_impl(sid, payload)

    except Exception as e:
        logger.exception(f"Invalid request in attempt_end_all: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="end",
                message=f"Invalid request: {e}",
            ).model_dump(mode="json"),
        )
