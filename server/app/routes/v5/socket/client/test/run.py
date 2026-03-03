"""Client-facing test_run handler.

Validates the client payload and emits to the internal "test_run" event.
All business logic lives in v5/internal/test/run.py.
"""

from typing import Any

from app.infra.globals import get_internal_sio, sio
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.routes.v5.socket.client.types import TestRunPayload
from app.routes.v5.socket.internal.test.types import TestErrorData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def test_run(sid: str, data: dict[str, Any]) -> None:
    """Handle test_run event from client."""
    try:
        payload = TestRunPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await internal_sio.emit(
                "test_error",
                TestErrorData(
                    sid=sid,
                    message="Profile not found. Please reconnect.",
                    error_type="auth",
                ).model_dump(mode="json"),
            )
            return

        await internal_sio.emit(
            "test_run",
            {
                "sid": sid,
                "profile_id": profile_id_str,
                **payload.model_dump(mode="json"),
            },
        )

    except Exception as e:
        logger.exception(f"Invalid request in test_run: {e}")
        await internal_sio.emit(
            "test_error",
            TestErrorData(
                sid=sid,
                message=f"Invalid request: {e}",
                error_type="run",
            ).model_dump(mode="json"),
        )
