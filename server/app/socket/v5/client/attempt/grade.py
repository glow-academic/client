"""Client-facing attempt_grade handler.

Validates the client payload and emits to the internal "attempt_grade" event.
All business logic lives in v5/internal/attempt/grade.py.
"""

from typing import Any

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio
from app.socket.v5.client.types import AttemptGradePayload
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def attempt_grade(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_grade event from client."""
    try:
        payload = AttemptGradePayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await internal_sio.emit(
                "attempt_error",
                {
                    "sid": sid,
                    "error_type": "grade",
                    "message": "Profile not found. Please reconnect.",
                },
            )
            return

        await internal_sio.emit(
            "attempt_grade",
            {
                "sid": sid,
                "profile_id": profile_id_str,
                **payload.model_dump(mode="json"),
            },
        )

    except Exception as e:
        logger.exception(f"Invalid request in attempt_grade: {e}")
        await internal_sio.emit(
            "attempt_error",
            {
                "sid": sid,
                "error_type": "grade",
                "message": f"Invalid request: {e}",
            },
        )
