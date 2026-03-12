"""Lifecycle handlers: connect and disconnect.

Handles profile-based socket management, guest connections, and cleanup.
"""

import uuid

from app.infra.globals import get_internal_sio, get_pool, sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)
from app.infra.websocket.decrement_guest_count import decrement_guest_count
from app.infra.websocket.find_chats_by_socket import find_chats_by_socket
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.infra.websocket.get_socket_owner import get_socket_owner
from app.infra.websocket.is_guest_socket import is_guest_socket
from app.infra.websocket.remove_active_connection import remove_active_connection
from app.infra.websocket.remove_guest_socket import remove_guest_socket
from app.infra.websocket.remove_socket_owner import remove_socket_owner
from app.infra.websocket.set_socket_owner import set_socket_owner
from app.routes.v5.tools.entries.activity.create import create_activity

internal_sio = get_internal_sio()


async def _mark_profile_inactive(profile_id: str, sid: str) -> None:
    """Mark a profile as inactive by creating an activity entry."""
    try:
        session_id_str = await find_session_by_socket(sid)
        if not session_id_str:
            return
        pool = get_pool()
        async with pool.acquire() as conn:
            await create_activity(
                conn,
                session_id=uuid.UUID(session_id_str),
                profile_id=uuid.UUID(profile_id),
            )
    except Exception:
        logger.warning("Failed to mark profile %s inactive", profile_id)


async def _mark_profile_active(profile_id: str, session_id: str | None) -> None:
    """Mark a profile as active by creating an activity entry."""
    if not session_id:
        return
    try:
        pool = get_pool()
        async with pool.acquire() as conn:
            await create_activity(
                conn,
                session_id=uuid.UUID(session_id),
                profile_id=uuid.UUID(profile_id),
            )
    except Exception:
        logger.warning("Failed to mark profile %s active", profile_id)


async def _store_session_id(sid: str, session_id: str) -> None:
    """Store session_id in Redis for activity logging."""
    try:
        from app.infra.globals import get_redis_client

        redis_client = get_redis_client()
        if redis_client:
            await redis_client.setex(f"socket_session:{sid}", 86400, session_id)
    except Exception:
        logger.warning("Failed to store session_id in Redis for sid %s", sid)


# ---------------------------------------------------------------------------
# Connect
# ---------------------------------------------------------------------------


@sio.event  # type: ignore
async def connect(
    sid: str,
    environ: dict[str, str],
    auth: dict[str, str] | None,
) -> bool:
    """Handle WebSocket connection with token-based auth.

    Auth flow:
      1. Client sends auth.token (Bearer JWT) and auth.apiKey (license key)
      2. Server validates both and resolves profile_id + session_id
      3. Guest connections use guestId query param (no auth required)
    """

    profile_id: str | None = None
    guest_id: str | None = None
    session_id: str | None = None

    # Primary: resolve identity from auth token
    if auth and auth.get("token"):
        try:
            from app.infra.identity.license_key import validate_license_key
            from app.infra.identity.resolve_identity import (
                extract_bearer_token,
                resolve_identity,
            )

            # Validate license key (if provided)
            api_key = auth.get("apiKey")
            if api_key:
                license_info = await validate_license_key(api_key)
                if not license_info.valid:
                    return False

            # Resolve identity from JWT
            token = extract_bearer_token(auth["token"])
            if token:
                pool = get_pool()
                identity = await resolve_identity(token, pool)
                profile_id = str(identity.profile_id)
                session_id = str(identity.session_id)
        except Exception:
            logger.warning("Failed to resolve identity from auth token for sid %s", sid)

    # Reject unauthenticated connections
    if not profile_id:
        logger.warning("Rejected unauthenticated socket connection for sid %s", sid)
        return False

    # Evict old socket for this profile
    old_sid = await get_socket_owner(profile_id)
    if old_sid and old_sid != sid:
        await remove_socket_owner(profile_id)
        await _mark_profile_inactive(profile_id, old_sid)
        await sio.disconnect(old_sid)

    # Register new socket
    await set_socket_owner(profile_id, sid)
    await sio.enter_room(sid, profile_id)

    if session_id:
        await _store_session_id(sid, session_id)

    await _mark_profile_active(profile_id, session_id)

    return True


# ---------------------------------------------------------------------------
# Disconnect
# ---------------------------------------------------------------------------


@sio.event  # type: ignore
async def disconnect(sid: str) -> None:
    """Handle WebSocket disconnection with cleanup."""
    # Profile cleanup
    profile_to_cleanup = await find_profile_by_socket(sid)
    if profile_to_cleanup:
        await remove_socket_owner(profile_to_cleanup)
        await _mark_profile_inactive(profile_to_cleanup, sid)

    # Guest cleanup
    if await is_guest_socket(sid):
        try:
            await remove_guest_socket(sid)
            await decrement_guest_count()
        except Exception:
            logger.warning("Failed to clean up guest socket %s", sid)

    # Voice session cleanup
    try:
        from app.infra.websocket.audio_lifecycle import cleanup_audio_session
        from app.infra.websocket.session_store import get_session_by_sid

        voice_session = get_session_by_sid(sid)
        if voice_session:
            await cleanup_audio_session(voice_session)
    except Exception:
        logger.warning("Failed to clean up voice session for socket %s", sid)

    # Remove from all active chat connections
    chat_ids = await find_chats_by_socket(sid)
    for chat_id in chat_ids:
        await remove_active_connection(chat_id, sid)
