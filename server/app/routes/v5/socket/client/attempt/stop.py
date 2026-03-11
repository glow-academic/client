from typing import Any

from app.infra.globals import get_internal_sio, sio
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.routes.v5.socket.client.types import AttemptStopPayload
from app.routes.v5.socket.internal.attempt.types import AttemptErrorData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def attempt_stop_message(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_stop_message event — stop message generation."""
    try:
        payload = AttemptStopPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="stop",
                    message="Profile not found. Please reconnect.",
                    chat_id=str(payload.chat_id),
                ).model_dump(mode="json"),
            )
            return

        await internal_sio.emit(
            "attempt_stop_message",
            {
                "sid": sid,
                "profile_id": profile_id_str,
                **payload.model_dump(mode="json"),
            },
        )
    except Exception as e:
        logger.exception(f"Invalid request in attempt_stop_message: {e}")
        chat_id = data.get("chat_id", "")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="stop",
                message=f"Invalid request: {e}",
                chat_id=str(chat_id) if chat_id else None,
            ).model_dump(mode="json"),
        )
