"""Attempt user speech complete handler.

Handles internal event:
- generate_audio_user_speech_complete: Create user message in DB and emit attempt_user_complete
"""

import logging
from typing import Any, cast

from app.infra.v4.websocket.attempt.audio_helpers import get_session_for_group
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.attempt.types import AttemptUserCompleteEvent
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


@internal_sio.on("generate_audio_user_speech_complete")  # type: ignore
async def handle_generate_audio_user_speech_complete(data: dict[str, Any]) -> None:
    """Handle generate_audio_user_speech_complete — finalize voice user message.

    Creates the user message in DB and emits attempt_user_complete to the client
    so it can replace the optimistic voice message with the server-confirmed version.
    """
    group_id = data.get("group_id")
    if not group_id:
        return

    session = get_session_for_group(group_id)
    if not session:
        return

    item_id = data.get("item_id")
    transcript = data.get("transcript", "")

    if not transcript or not transcript.strip():
        return

    try:
        # Find profile_id from the session's sid
        import uuid

        from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket

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

        event = AttemptUserCompleteEvent(
            chat_id=session.chat_id,
            message_id=str(result.user_message_id),
            content=transcript.strip(),
            created_at=result.created_at.isoformat() if result.created_at else "",
            item_id=item_id,
        )

        await sio.emit(
            "attempt_user_complete",
            event.model_dump(mode="json"),
            room=session.sid,
        )

        logger.info(
            f"Voice user message finalized - group_id={group_id}, "
            f"message_id={result.user_message_id}, item_id={item_id}"
        )

    except Exception as e:
        logger.exception(f"Error finalizing voice user message: {e}")
