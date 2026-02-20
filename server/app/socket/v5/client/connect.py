"""Lifecycle handlers: connect and disconnect.

Handles profile-based socket management, guest connections, and cleanup.
"""

import time
import uuid
from datetime import UTC, datetime
from typing import cast

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.add_guest_socket import add_guest_socket
from app.infra.v4.websocket.decrement_guest_count import decrement_guest_count
from app.infra.v4.websocket.find_chats_by_socket import find_chats_by_socket
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.get_socket_owner import get_socket_owner
from app.infra.v4.websocket.increment_guest_count import increment_guest_count
from app.infra.v4.websocket.is_guest_socket import is_guest_socket
from app.infra.v4.websocket.remove_active_connection import remove_active_connection
from app.infra.v4.websocket.remove_guest_socket import remove_guest_socket
from app.infra.v4.websocket.remove_socket_owner import remove_socket_owner
from app.infra.v4.websocket.set_socket_owner import set_socket_owner
from app.main import sio
from app.socket.v5.client.types import ConnectionConfirmedPayload
from app.sql.types import (
    UpdateProfileToActiveSqlParams,
    UpdateProfileToActiveSqlRow,
    UpdateProfileToInactiveSqlParams,
    UpdateProfileToInactiveSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_MARK_INACTIVE = "app/sql/v4/queries/profile/update_profile_to_inactive_complete.sql"
SQL_MARK_ACTIVE = "app/sql/v4/queries/profile/update_profile_to_active_complete.sql"


async def _mark_profile_inactive(profile_id: str) -> None:
    """Mark a profile as inactive in the database."""
    try:
        async with get_db_connection() as conn:
            async with conn.transaction():
                params = UpdateProfileToInactiveSqlParams(
                    profile_id=uuid.UUID(profile_id),
                    last_active=datetime.now(UTC).isoformat(),
                )
                await cast(
                    UpdateProfileToInactiveSqlRow,
                    execute_sql_typed(conn, SQL_MARK_INACTIVE, params=params),
                )
    except Exception:
        pass


async def _mark_profile_active(profile_id: str) -> None:
    """Mark a profile as active in the database."""
    try:
        async with get_db_connection() as conn:
            async with conn.transaction():
                params = UpdateProfileToActiveSqlParams(
                    profile_id=uuid.UUID(profile_id),
                    last_active=datetime.now(UTC).isoformat(),
                )
                await cast(
                    UpdateProfileToActiveSqlRow,
                    execute_sql_typed(conn, SQL_MARK_ACTIVE, params=params),
                )
    except Exception:
        pass


async def _store_session_id(sid: str, session_id: str) -> None:
    """Store session_id in Redis for activity logging."""
    try:
        from app.main import get_redis_client

        redis_client = get_redis_client()
        if redis_client:
            await redis_client.setex(f"socket_session:{sid}", 86400, session_id)
    except Exception:
        pass


# ---------------------------------------------------------------------------
# Connect
# ---------------------------------------------------------------------------


@sio.event  # type: ignore
async def connect(
    sid: str,
    environ: dict[str, str],
    auth: dict[str, str] | None,  # noqa: ARG001
) -> bool:
    """Handle WebSocket connection with profile-based socket management."""
    from urllib.parse import parse_qs

    query_string = environ.get("QUERY_STRING", "")
    profile_id: str | None = None
    guest_id: str | None = None
    session_id: str | None = None

    try:
        params = parse_qs(query_string)
        profile_id = params.get("profileId", [None])[0]
        guest_id = params.get("guestId", [None])[0]
        session_id = params.get("sessionId", [None])[0]
    except Exception:
        pass

    # Validate UUIDs
    if profile_id:
        try:
            uuid.UUID(profile_id)
        except ValueError:
            profile_id = None
    if guest_id:
        try:
            uuid.UUID(guest_id)
        except ValueError:
            guest_id = None

    if profile_id:
        # Evict old socket for this profile
        old_sid = await get_socket_owner(profile_id)
        if old_sid and old_sid != sid:
            await remove_socket_owner(profile_id)
            await _mark_profile_inactive(profile_id)
            await sio.disconnect(old_sid)

        # Register new socket
        await set_socket_owner(profile_id, sid)
        await sio.enter_room(sid, profile_id)

        if session_id:
            await _store_session_id(sid, session_id)

        await _mark_profile_active(profile_id)
    else:
        # Guest connection
        if guest_id:
            await sio.enter_room(sid, f"guest_{guest_id}")
            try:
                await add_guest_socket(sid)
                await increment_guest_count()
            except Exception:
                pass

        await sio.emit(
            "connection_confirmed",
            ConnectionConfirmedPayload(
                sid=sid,
                profile_id=profile_id,
                guest_id=guest_id,
                server_time=time.time(),
            ).model_dump(mode="json"),
            room=sid,
        )

    try:
        await log_websocket_activity(
            sid=sid,
            event_key="websocket.connected",
            template="{{ actor.name }} connected to WebSocket",
            context={},
            endpoint="/socket/v5/connect",
            error=False,
        )
    except Exception:
        pass

    return True


# ---------------------------------------------------------------------------
# Disconnect
# ---------------------------------------------------------------------------


@sio.event  # type: ignore
async def disconnect(sid: str) -> None:
    """Handle WebSocket disconnection with cleanup."""
    # Log before cleanup so profile lookup still works
    try:
        await log_websocket_activity(
            sid=sid,
            event_key="websocket.disconnected",
            template="{{ actor.name }} disconnected from WebSocket",
            context={},
            endpoint="/socket/v5/disconnect",
            error=False,
        )
    except Exception:
        pass

    # Profile cleanup
    profile_to_cleanup = await find_profile_by_socket(sid)
    if profile_to_cleanup:
        await remove_socket_owner(profile_to_cleanup)
        await _mark_profile_inactive(profile_to_cleanup)

    # Guest cleanup
    if await is_guest_socket(sid):
        try:
            await remove_guest_socket(sid)
            await decrement_guest_count()
        except Exception:
            pass

    # Voice session cleanup
    try:
        from app.infra.v4.websocket.audio_lifecycle import cleanup_audio_session
        from app.infra.v4.websocket.session_store import get_session_by_sid

        voice_session = get_session_by_sid(sid)
        if voice_session:
            await cleanup_audio_session(voice_session)
    except Exception:
        pass

    # Remove from all active chat connections
    chat_ids = await find_chats_by_socket(sid)
    for chat_id in chat_ids:
        await remove_active_connection(chat_id, sid)
