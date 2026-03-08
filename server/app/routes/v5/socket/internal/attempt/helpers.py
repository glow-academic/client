"""Shared helpers for attempt handlers (proceed).

Thin wrapper — delegates to attempt_events_impl.emit_chat_generate_impl.
"""

from __future__ import annotations

import uuid

from app.infra.globals import get_internal_sio, get_redis_client
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.websocket.attempt_events_impl import emit_chat_generate_impl
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.infra.websocket.get_db_connection import get_db_connection
from app.infra.websocket.socket_event import make_emit


async def emit_chat_generate(
    sid: str,
    profile_id: uuid.UUID,
    attempt_id: uuid.UUID,
    chat_entry_id: uuid.UUID,
    department_id: uuid.UUID,
    attempt_chat_id: uuid.UUID | None,
    draft_id: uuid.UUID | None = None,
    resource_types: list[str] | None = None,
    user_instructions: list[str] | None = None,
    save: bool = True,
) -> None:
    """Create run + profile-run link, then emit to generate pipeline."""
    session_id_str = await find_session_by_socket(sid)
    if not session_id_str:
        raise ValueError("Session not found for socket")
    session_id = uuid.UUID(session_id_str)

    async with get_db_connection() as conn:
        identity = await resolve_profile_identity_context(
            conn, profile_id, get_redis_client()
        )
        profiles_id = identity.profiles_id if identity else None

        await emit_chat_generate_impl(
            emit=make_emit(),
            conn=conn,
            sid=sid,
            profile_id=profile_id,
            profiles_id=profiles_id,
            session_id=session_id,
            attempt_id=attempt_id,
            chat_entry_id=chat_entry_id,
            department_id=department_id,
            attempt_chat_id=attempt_chat_id,
            draft_id=draft_id,
            resource_types=resource_types,
            user_instructions=user_instructions,
            save=save,
        )
