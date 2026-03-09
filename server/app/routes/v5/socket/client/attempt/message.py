"""Client handler: attempt_message — thin wrapper."""

from typing import Any

from app.infra.globals import get_pool, get_redis_client, sio
from app.infra.websocket.attempt_events_impl import attempt_message_impl
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.infra.websocket.socket_event import make_emit
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


@sio.event  # type: ignore
async def attempt_message(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_message — delegate to impl."""
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    session_id_str = await find_session_by_socket(sid)
    if not session_id_str:
        return

    await attempt_message_impl(
        {**data, "sid": sid},
        emit=make_emit(),
        pool=get_pool(),
        redis=get_redis_client(),
        profile_id=profile_id_str,
        session_id=session_id_str,
    )
