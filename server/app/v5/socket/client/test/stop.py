"""Test stop handler.

Handles: test_stop — stop current test execution.
"""

from typing import Any

from app.globals import get_internal_sio, sio
from app.v5.socket.client.types import TestStopPayload
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def test_stop(sid: str, data: dict[str, Any]) -> None:
    """Handle test_stop event from client."""
    try:
        payload = TestStopPayload(**data)
        invocation_id_str = str(payload.invocation_id)

        await internal_sio.emit(
            "test_stopped",
            {
                "sid": sid,
                "rooms": [sid, f"test_{invocation_id_str}"],
                "invocation_id": invocation_id_str,
                "success": True,
                "message": "Test execution stopped",
            },
        )

        logger.info(f"Test stopped - invocation_id={invocation_id_str}")

    except Exception as e:
        logger.exception(f"Error in test_stop: {e}")
        await internal_sio.emit(
            "test_error",
            {
                "sid": sid,
                "rooms": [sid],
                "invocation_id": str(data.get("invocation_id", "")),
                "message": f"Failed to stop test: {e}",
                "error_type": "stop",
            },
        )
