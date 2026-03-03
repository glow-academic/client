"""Client-facing test_next handler.

Validates the client payload and emits to the internal "test_next" event.
All business logic lives in v5/internal/test/next.py.
"""

from typing import Any

from app.v5.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import get_internal_sio, sio
from app.v5.socket.client.types import TestNextPayload
from app.v5.socket.internal.test.types import TestErrorData
from app.v5.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def test_next(sid: str, data: dict[str, Any]) -> None:
    """Handle test_next event from client."""
    try:
        payload = TestNextPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await internal_sio.emit(
                "test_error",
                TestErrorData(
                    sid=sid,
                    rooms=[sid],
                    message="Profile not found. Please reconnect.",
                    error_type="auth",
                ).model_dump(mode="json"),
            )
            return

        await internal_sio.emit(
            "test_next",
            {
                "sid": sid,
                "profile_id": profile_id_str,
                **payload.model_dump(mode="json"),
            },
        )

    except Exception as e:
        logger.exception(f"Invalid request in test_next: {e}")
        await internal_sio.emit(
            "test_error",
            TestErrorData(
                sid=sid,
                rooms=[sid],
                message=f"Invalid request: {e}",
                error_type="validation",
            ).model_dump(mode="json"),
        )
