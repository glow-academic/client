"""Client-facing attempt_next handler.

Validates the client payload and emits to the internal "attempt_next" event.
All business logic lives in v5/internal/attempt/next.py.
"""

from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio
from app.socket.v5.client.types import AttemptNextPayload
from app.socket.v5.internal.attempt.types import AttemptErrorData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def attempt_next(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_next event from client."""
    try:
        payload = AttemptNextPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="next",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
            )
            return

        await internal_sio.emit(
            "attempt_next",
            {
                "sid": sid,
                "profile_id": profile_id_str,
                **payload.model_dump(mode="json"),
            },
        )

    except Exception as e:
        logger.exception(f"Invalid request in attempt_next: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="next",
                message=f"Invalid request: {e}",
            ).model_dump(mode="json"),
        )
