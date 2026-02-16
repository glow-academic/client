"""Attempt audio start handler — thin wrapper.

Handles WebSocket event:
- attempt_audio_start: Start a voice session (BFF pre-generation validation)

Validates context, creates empty user + assistant placeholders via prepare SQL,
then delegates to attempt_generate for the LLM pipeline.
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.session_store import get_session_by_group_id
from app.main import (
    get_internal_sio,
    sio,
)
from app.socket.v4.artifacts.attempt.types import (
    ATTEMPT_MESSAGE_ENTRY_TYPES,
    AttemptAudioReadyEvent,
    AttemptAudioStartPayload,
    AttemptUnifiedErrorEvent,
)
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

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_AUDIO_START_CONTEXT = (
    "app/sql/v4/queries/generate/attempt/get_audio_start_context_complete.sql"
)
SQL_PATH_PREPARE = (
    "app/sql/v4/queries/generate/attempt/prepare_attempt_audio_complete.sql"
)


@sio.event  # type: ignore
async def attempt_audio_start(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_audio_start event — thin wrapper.

    1. Context SQL — validate chat, rate limits
    2. Prepare SQL — create empty user + assistant placeholders
    3. Delegate to attempt_generate
    """
    try:
        payload = AttemptAudioStartPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        chat_id = str(payload.chat_id)

        if not profile_id_str:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    group_id=None,
                    type="audio",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
                room=sid,
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
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    group_id=None,
                    type="audio",
                    message="Chat not found",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        if context_row.chat_is_completed:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    group_id=None,
                    type="audio",
                    message="Chat is already completed",
                ).model_dump(mode="json"),
                room=sid,
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
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    group_id=None,
                    type="audio",
                    message=error_msg,
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        attempt_id = context_row.attempt_id
        if not attempt_id:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    group_id=None,
                    type="audio",
                    message="Attempt not found for this chat",
                ).model_dump(mode="json"),
                room=sid,
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
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    group_id=None,
                    type="audio",
                    message="Failed to prepare audio session",
                ).model_dump(mode="json"),
                room=sid,
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
                # TODO: modality from audio config section, keeping text for now
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
                endpoint="/socket/v4/attempt/audio_start",
                error=False,
            )
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error in attempt_audio_start: {str(e)}")
        chat_id = data.get("chat_id", "")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                group_id=None,
                type="audio",
                message=f"Failed to start voice session: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@internal_sio.on("generate_audio_start")  # type: ignore
async def handle_audio_start(data: dict[str, Any]) -> None:
    """Translate generate_audio_start → attempt_audio_ready for client."""
    group_id = data.get("group_id")
    sid = data.get("sid")
    if not sid or not group_id:
        return
    session = get_session_by_group_id(group_id)
    chat_id = session.chat_id if session else group_id
    await sio.emit(
        "attempt_audio_ready",
        AttemptAudioReadyEvent(
            chat_id=chat_id, success=True, message="Voice session ready"
        ).model_dump(mode="json"),
        room=sid,
    )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/audio_start", response_model=dict[str, bool])
async def attempt_audio_start_api(request: AttemptAudioStartPayload) -> dict[str, bool]:
    """Client-to-server event: Start a voice session."""
    return {"success": True}


@server_router.post("/attempt/audio_ready", response_model=dict[str, bool])
async def attempt_audio_ready_api(request: AttemptAudioReadyEvent) -> dict[str, bool]:
    """Server-to-client event: Voice session is ready."""
    return {"success": True}
