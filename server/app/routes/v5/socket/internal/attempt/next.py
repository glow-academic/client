"""Internal handler: attempt_next — thin wrapper."""

from typing import Any

from app.infra.globals import get_internal_sio, get_pool, get_redis_client
from app.infra.websocket.attempt_events_impl import attempt_next_impl
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.infra.websocket.socket_event import make_emit
from app.routes.v5.socket.client.types import AttemptNextPayload
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("attempt_next")  # type: ignore
async def attempt_next_handler(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    if not sid:
        return
    try:
        payload = AttemptNextPayload(**data)
    except Exception as e:
        logger.exception(f"Invalid attempt_next payload: {e}")
        return

    profile_id = data.get("profile_id") or await find_profile_by_socket(sid)
    if not profile_id:
        logger.warning("No profile_id for attempt_next")
        return

    session_id = await find_session_by_socket(sid)
    if not session_id:
        logger.warning("No session_id for attempt_next")
        return

    await attempt_next_impl(
        data,
        emit=make_emit(),
        attempt_id=str(payload.attempt_id),
        draft_id=str(payload.draft_id) if payload.draft_id else None,
        profile_id=profile_id,
        session_id=session_id,
        pool=get_pool(),
        redis=get_redis_client(),
    )
