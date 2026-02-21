"""Client-facing attempt_start handler.

Validates the client payload and emits to the internal "attempt_start" event.
All business logic lives in v5/internal/attempt/start.py.
"""

from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio
from app.socket.v5.client.types import AttemptStartPayload
from app.socket.v5.internal.attempt.types import AttemptErrorData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def attempt_start(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_start event from client."""
    try:
        payload = AttemptStartPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="start",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
            )
            return

        await internal_sio.emit(
            "attempt_start",
            {
                "sid": sid,
                "profile_id": profile_id_str,
                **payload.model_dump(mode="json"),
            },
        )

    except Exception as e:
        logger.exception(f"Invalid request in attempt_start: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="start",
                message=f"Invalid request: {e}",
            ).model_dump(mode="json"),
        )
