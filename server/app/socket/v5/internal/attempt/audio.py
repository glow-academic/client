"""Internal attempt audio translators — domain layer.

Listens to generic `generate_audio_*` internal events, resolves group_id → chat_id
via session store, and emits to `attempt_progress` for the server layer.

Events handled:
- generate_audio_start → attempt_progress(type=ready)
- generate_audio_complete → attempt_progress(type=audio_ended)
- generate_audio_delta → attempt_progress(type=assistant_audio)
- generate_audio_user_speech_start → attempt_progress(type=user_start)
- generate_audio_user_speech_delta → attempt_progress(type=user_delta)
- generate_audio_user_speech_complete → attempt_progress(type=user_complete) [DB write]
- generate_audio_error → attempt_progress(type=error)
"""

import logging
import uuid
from typing import Any, cast

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.session_store import get_session_by_group_id
from app.main import get_internal_sio
from app.sql.types import (
    PrepareVoiceUserMessageSqlParams,
    PrepareVoiceUserMessageSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

logger = logging.getLogger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_VOICE_USER_MSG = (
    "app/sql/v4/queries/generate/attempt/prepare_voice_user_message_complete.sql"
)


@internal_sio.on("generate_audio_start")  # type: ignore
async def handle_audio_start(data: dict[str, Any]) -> None:
    """Translate generate_audio_start → attempt_progress(type=ready)."""
    group_id = data.get("group_id")
    sid = data.get("sid")
    if not sid or not group_id:
        return
    session = get_session_by_group_id(group_id)
    chat_id = session.chat_id if session else group_id
    await internal_sio.emit(
        "attempt_progress",
        {
            "type": "ready",
            "sid": sid,
            "chat_id": chat_id,
            "success": True,
            "message": "Voice session ready",
        },
    )


@internal_sio.on("generate_audio_complete")  # type: ignore
async def handle_audio_complete(data: dict[str, Any]) -> None:
    """Translate generate_audio_complete → attempt_progress(type=audio_ended)."""
    sid = data.get("sid")
    group_id = data.get("group_id")
    if not sid:
        return
    session = get_session_by_group_id(group_id) if group_id else None
    chat_id = session.chat_id if session else (group_id or "")
    await internal_sio.emit(
        "attempt_progress",
        {
            "type": "audio_ended",
            "sid": sid,
            "chat_id": chat_id,
            "success": True,
            "message": "Voice session stopped",
        },
    )

    # Log activity
    try:
        await log_websocket_activity(
            sid=sid,
            event_key="attempt.audio.stopped",
            template="{{ actor.name }} stopped voice session",
            context={"chat_id": chat_id, "group_id": group_id},
            endpoint="/socket/v5/attempt/audio_stop",
            error=False,
        )
    except Exception:
        pass


@internal_sio.on("generate_audio_delta")  # type: ignore
async def handle_audio_delta(data: dict[str, Any]) -> None:
    """Translate generate_audio_delta → attempt_progress(type=assistant_audio)."""
    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return
    audio_data = data.get("audio")
    if not audio_data:
        return
    await internal_sio.emit(
        "attempt_progress",
        {
            "type": "assistant_audio",
            "sid": session.sid,
            "chat_id": session.chat_id,
            "audio": audio_data,
        },
    )


@internal_sio.on("generate_audio_user_speech_start")  # type: ignore
async def handle_user_speech_start(data: dict[str, Any]) -> None:
    """Translate generate_audio_user_speech_start → attempt_progress(type=user_start)."""
    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return
    item_id = data.get("item_id")
    if not item_id:
        return
    await internal_sio.emit(
        "attempt_progress",
        {
            "type": "user_start",
            "sid": session.sid,
            "chat_id": session.chat_id,
            "item_id": item_id,
        },
    )


@internal_sio.on("generate_audio_user_speech_delta")  # type: ignore
async def handle_user_speech_delta(data: dict[str, Any]) -> None:
    """Translate generate_audio_user_speech_delta → attempt_progress(type=user_delta)."""
    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return
    item_id = data.get("item_id")
    if not item_id:
        return
    await internal_sio.emit(
        "attempt_progress",
        {
            "type": "user_delta",
            "sid": session.sid,
            "chat_id": session.chat_id,
            "item_id": item_id,
            "transcript": data.get("transcript", ""),
        },
    )


@internal_sio.on("generate_audio_user_speech_complete")  # type: ignore
async def handle_user_speech_complete(data: dict[str, Any]) -> None:
    """Translate generate_audio_user_speech_complete → DB write + attempt_progress(type=user_complete)."""
    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return

    item_id = data.get("item_id")
    transcript = data.get("transcript", "")
    if not transcript or not transcript.strip():
        return

    try:
        profile_id_str = await find_profile_by_socket(session.sid)
        if not profile_id_str:
            logger.warning(
                f"No profile for sid={session.sid}, skipping voice message finalization"
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        chat_id = uuid.UUID(session.chat_id)

        # Create user message in DB
        async with get_db_connection() as conn:
            async with conn.transaction():
                result = cast(
                    PrepareVoiceUserMessageSqlRow,
                    await execute_sql_typed(
                        conn,
                        SQL_PATH_VOICE_USER_MSG,
                        params=PrepareVoiceUserMessageSqlParams(
                            p_profile_id=profile_id,
                            p_chat_id=chat_id,
                            p_message=transcript.strip(),
                        ),
                    ),
                )

        if not result or not result.user_message_id:
            logger.error(f"Failed to create voice user message - group_id={group_id}")
            return

        await internal_sio.emit(
            "attempt_progress",
            {
                "type": "user_complete",
                "sid": session.sid,
                "chat_id": session.chat_id,
                "message_id": str(result.user_message_id),
                "content": transcript.strip(),
                "created_at": (
                    result.created_at.isoformat() if result.created_at else ""
                ),
                "item_id": item_id,
            },
        )

        logger.info(
            f"Voice user message finalized - group_id={group_id}, "
            f"message_id={result.user_message_id}, item_id={item_id}"
        )

    except Exception as e:
        logger.exception(f"Error finalizing voice user message: {e}")


@internal_sio.on("generate_audio_error")  # type: ignore
async def handle_audio_error(data: dict[str, Any]) -> None:
    """Translate generate_audio_error → attempt_progress(type=error)."""
    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return
    await internal_sio.emit(
        "attempt_progress",
        {
            "type": "error",
            "sid": session.sid,
            "error_type": "audio",
            "message": data.get("error_message", "Unknown audio error"),
            "chat_id": session.chat_id,
        },
    )
