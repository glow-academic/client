"""Test end all handler.

Handles: test_end_all — end all remaining invocations in a test.

Delegates to test_proceed(complete_all=True), which marks all remaining
invocations as completed and emits test_ended.
"""

from typing import Any

from app.globals import get_internal_sio, sio
from app.routes.v5.socket.client.types import TestEndAllPayload
from app.routes.v5.socket.internal.test.types import TestErrorData, TestProceedData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def test_end_all(sid: str, data: dict[str, Any]) -> None:
    """Handle test_end_all event — end all invocations in a test."""
    try:
        payload = TestEndAllPayload(**data)

        await internal_sio.emit(
            "test_proceed",
            TestProceedData(
                sid=sid,
                test_id=str(payload.test_id),
                complete_all=True,
            ).model_dump(mode="json"),
        )

    except Exception as e:
        logger.exception(f"Error in test_end_all: {e}")
        await internal_sio.emit(
            "test_error",
            TestErrorData(
                sid=sid,
                message=f"Failed to end all invocations: {e}",
                error_type="end",
            ).model_dump(mode="json"),
        )
