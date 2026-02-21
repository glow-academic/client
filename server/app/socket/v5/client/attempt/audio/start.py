"""Client-facing attempt_audio_start handler.

Validates context, creates placeholders via prepare SQL,
then delegates to attempt_generate for the LLM pipeline.
"""

import uuid
from typing import Any, cast

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v5.client.types import AttemptAudioStartPayload
from app.sql.types import (
    GetAudioStartContextSqlParams,
    GetAudioStartContextSqlRow,
    PrepareAttemptAudioSqlParams,
    PrepareAttemptAudioSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

ATTEMPT_MESSAGE_ENTRY_TYPES = ["contents", "hints"]

SQL_PATH_AUDIO_START_CONTEXT = (
    "app/sql/v4/queries/generate/attempt/get_audio_start_context_complete.sql"
)
SQL_PATH_PREPARE = (
    "app/sql/v4/queries/generate/attempt/prepare_attempt_audio_complete.sql"
)


@sio.event  # type: ignore
async def attempt_audio_start(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_audio_start — validate, prepare, delegate to generate."""
    try:
        payload = AttemptAudioStartPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        chat_id = str(payload.chat_id)

        if not profile_id_str:
            await internal_sio.emit(
                "attempt_progress",
                {
                    "type": "error",
                    "sid": sid,
                    "error_type": "audio",
                    "message": "Profile not found. Please reconnect.",
                },
            )
            return

        profile_id = uuid.UUID(profile_id_str)

        # 1. Context SQL — validate chat, rate limits
        async with get_db_connection() as conn:
            context_row = cast(
                GetAudioStartContextSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH_AUDIO_START_CONTEXT,
                    params=GetAudioStartContextSqlParams(
                        p_profile_id=profile_id,
                        p_chat_id=payload.chat_id,
                    ),
                ),
            )

        if not context_row or not context_row.chat_exists:
            await internal_sio.emit(
                "attempt_progress",
                {
                    "type": "error",
                    "sid": sid,
                    "error_type": "audio",
                    "message": "Chat not found",
                    "chat_id": chat_id,
                },
            )
            return

        if context_row.chat_is_completed:
            await internal_sio.emit(
                "attempt_progress",
                {
                    "type": "error",
                    "sid": sid,
                    "error_type": "audio",
                    "message": "Chat is already completed",
                    "chat_id": chat_id,
                },
            )
            return

        # Rate limit validation
        requests_per_day = context_row.requests_per_day
        runs_today = context_row.runs_today or 0
        if requests_per_day is not None and runs_today >= requests_per_day:
            error_msg = (
                f"Rate limit exceeded ({runs_today}/{requests_per_day} requests today)"
            )
            logger.error(
                f"Audio start rate limit exceeded - "
                f"profile_id={profile_id}, chat_id={chat_id}"
            )
            await internal_sio.emit(
                "attempt_progress",
                {
                    "type": "error",
                    "sid": sid,
                    "error_type": "audio",
                    "message": error_msg,
                    "chat_id": chat_id,
                },
            )
            return

        attempt_id = context_row.attempt_id
        if not attempt_id:
            await internal_sio.emit(
                "attempt_progress",
                {
                    "type": "error",
                    "sid": sid,
                    "error_type": "audio",
                    "message": "Attempt not found for this chat",
                    "chat_id": chat_id,
                },
            )
            return

        # 2. Prepare SQL — create empty user + assistant placeholders
        async with get_db_connection() as conn:
            prepare_row = cast(
                PrepareAttemptAudioSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH_PREPARE,
                    params=PrepareAttemptAudioSqlParams(
                        p_profile_id=profile_id,
                        p_chat_id=payload.chat_id,
                    ),
                ),
            )

        if not prepare_row or not prepare_row.run_id:
            await internal_sio.emit(
                "attempt_progress",
                {
                    "type": "error",
                    "sid": sid,
                    "error_type": "audio",
                    "message": "Failed to prepare audio session",
                    "chat_id": chat_id,
                },
            )
            return

        # 3. Delegate to attempt_generate
        await internal_sio.emit(
            "attempt_generate",
            {
                "sid": sid,
                "attempt_id": str(attempt_id),
                "entry_types": ATTEMPT_MESSAGE_ENTRY_TYPES,
                "run_id": str(prepare_row.run_id),
                "group_id": str(prepare_row.group_id),
                "chat_id": chat_id,
            },
        )

        logger.info(
            f"Audio start delegated to attempt_generate - "
            f"chat_id={chat_id}, run_id={prepare_row.run_id}, "
            f"group_id={prepare_row.group_id}"
        )

        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="attempt.audio.started",
                template="{{ actor.name }} started voice session",
                context={
                    "chat_id": chat_id,
                    "group_id": str(prepare_row.group_id),
                },
                endpoint="/socket/v5/attempt/audio_start",
                error=False,
            )
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error in attempt_audio_start: {e}")
        await internal_sio.emit(
            "attempt_progress",
            {
                "type": "error",
                "sid": sid,
                "error_type": "audio",
                "message": f"Failed to start voice session: {e}",
            },
        )
