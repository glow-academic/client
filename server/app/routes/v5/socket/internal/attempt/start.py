"""Internal handler: attempt_start — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio, get_redis_client
from app.infra.websocket.attempt_events_impl import attempt_start_impl
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.infra.websocket.get_db_connection import get_db_connection
from app.infra.websocket.socket_event import make_emit

internal_sio = get_internal_sio()


@internal_sio.on("attempt_start")  # type: ignore
async def attempt_start_handler(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    if not sid:
        return

    profile_id = data.get("profile_id") or await find_profile_by_socket(sid)
    if not profile_id:
        return

    session_id = await find_session_by_socket(sid)
    if not session_id:
        return

    async with get_db_connection() as conn:
        await attempt_start_impl(
            data,
            emit=make_emit(),
            conn=conn,
            redis=get_redis_client(),
            profile_id=profile_id,
            session_id=session_id,
        )
