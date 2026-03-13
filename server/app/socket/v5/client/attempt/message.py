"""Client handler: attempt_message — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio, sio
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.socket.v5.client.types import AttemptMessagePayload

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def attempt_message(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_message — validate transport data and dispatch internal."""
    payload = AttemptMessagePayload(**data)
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    session_id_str = await find_session_by_socket(sid)
    if not session_id_str:
        return

    await internal_sio.emit(
        "attempt_message",
        {
            "sid": sid,
            "profile_id": profile_id_str,
            "session_id": session_id_str,
            **payload.model_dump(mode="json"),
        },
    )
