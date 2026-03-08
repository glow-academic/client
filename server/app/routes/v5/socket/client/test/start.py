"""Client-facing test_start handler.

Validates the client payload and emits to the internal "test_start" event.
All business logic lives in v5/internal/test/start.py.
"""

from typing import Any
from uuid import UUID

from app.infra.globals import get_internal_sio, get_redis_client, sio
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.get_db_connection import get_db_connection
from app.routes.v5.socket.client.types import TestStartPayload
from app.routes.v5.socket.internal.test.types import TestErrorData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def test_start(sid: str, data: dict[str, Any]) -> None:
    """Handle test_start event from client."""
    try:
        payload = TestStartPayload(**data)
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

        # Resolve profiles_id (resource) from profile_id (artifact)
        redis = get_redis_client()
        async with get_db_connection() as conn:
            ctx = await resolve_profile_identity_context(
                conn, UUID(profile_id_str), redis=redis
            )

        if not ctx:
            await internal_sio.emit(
                "test_error",
                TestErrorData(
                    sid=sid,
                    message="Profile context not found. Please reconnect.",
                    error_type="auth",
                ).model_dump(mode="json"),
            )
            return

        await internal_sio.emit(
            "test_start",
            {
                "sid": sid,
                "profile_id": profile_id_str,
                "profiles_id": str(ctx.profiles_id),
                **payload.model_dump(mode="json"),
            },
        )

    except Exception as e:
        logger.exception(f"Invalid request in test_start: {e}")
        await internal_sio.emit(
            "test_error",
            TestErrorData(
                sid=sid,
                message=f"Invalid request: {e}",
                error_type="start",
            ).model_dump(mode="json"),
        )
