"""Internal handler: attempt_proceed — thin wrapper."""

from typing import Any
from uuid import UUID

from app.infra.globals import get_internal_sio, get_redis_client
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.websocket.attempt_events_impl import attempt_proceed_impl
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.infra.websocket.get_db_connection import get_db_connection
from app.infra.websocket.socket_event import make_emit
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("attempt_proceed")  # type: ignore
async def attempt_proceed_handler(data: dict[str, Any]) -> None:
    sid = data.get("sid", "")
    if not sid:
        return

    profile_id = data.get("profile_id") or await find_profile_by_socket(sid)
    if not profile_id:
        logger.warning("No profile_id for attempt_proceed")
        return

    session_id = await find_session_by_socket(sid)
    if not session_id:
        return

    async with get_db_connection() as conn:
        redis = get_redis_client()
        identity = await resolve_profile_identity_context(
            conn, UUID(profile_id), redis, bypass_cache=True, session_id=UUID(session_id)
        )
        profiles_id = identity.profiles_id if identity else None

        await attempt_proceed_impl(
            data,
            emit=make_emit(),
            conn=conn,
            redis=redis,
            profile_id=profile_id,
            session_id=session_id,
            profiles_id=profiles_id,
        )
