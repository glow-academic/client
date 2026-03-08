"""Trivial attempt event translators — pure business logic with emit: EmitFn.

Each function receives raw event data, resolves context (session, profile),
and emits a translated event. No DB writes, no inline SQL.
"""

from __future__ import annotations

from typing import Any

import uuid

import asyncpg

from app.infra.websocket.attempt_types import (
    AttemptAssistantProgressData,
    AttemptAudioEndedData,
    AttemptAudioReadyData,
    AttemptErrorData,
    AttemptProceedData,
    AttemptStoppedData,
    AttemptUserProgressData,
    AttemptUserReceivedProgressData,
    AttemptUserReceivedStartData,
    AttemptUserStartData,
)
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.session_store import get_session_by_group_id
from app.infra.websocket.socket_event import EmitFn, internal_event
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


# ---------------------------------------------------------------------------
# attempt_user_received_progress → attempt_user_progress
# ---------------------------------------------------------------------------


async def user_progress_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
) -> None:
    """Forward transcript progress to server/ layer."""
    sid = data.get("sid", "")
    chat_id = data.get("chat_id", "")
    if not sid or not chat_id:
        return

    await emit([
        internal_event(
            "attempt_user_progress",
            AttemptUserProgressData(
                sid=sid,
                chat_id=chat_id,
                item_id=data.get("item_id"),
                transcript=data.get("transcript", ""),
                rooms=data.get("rooms"),
            ).model_dump(mode="json"),
        )
    ])


# ---------------------------------------------------------------------------
# generate_audio_session_start → attempt_audio_ready
# ---------------------------------------------------------------------------


async def audio_session_start_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
) -> None:
    """Translate generate_audio_session_start → attempt_audio_ready."""
    group_id = data.get("group_id")
    sid = data.get("sid")
    if not sid or not group_id:
        return
    session = get_session_by_group_id(group_id)
    chat_id = session.chat_id if session else group_id
    await emit([
        internal_event(
            "attempt_audio_ready",
            AttemptAudioReadyData(
                sid=sid,
                chat_id=chat_id,
                success=True,
                message="Voice session ready",
            ).model_dump(mode="json"),
        )
    ])


# ---------------------------------------------------------------------------
# generate_audio_progress → attempt_assistant_progress(content_type=audio)
# ---------------------------------------------------------------------------


async def audio_delta_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
) -> None:
    """Translate generate_audio_progress → attempt_assistant_progress(audio)."""
    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return
    audio_data = data.get("audio")
    if not audio_data:
        return
    await emit([
        internal_event(
            "attempt_assistant_progress",
            AttemptAssistantProgressData(
                sid=session.sid,
                chat_id=session.chat_id,
                content_type="audio",
                audio=audio_data,
            ).model_dump(mode="json"),
        )
    ])


# ---------------------------------------------------------------------------
# generate_audio_user_speech_start → attempt_user_received_start
# ---------------------------------------------------------------------------


async def audio_speech_start_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
) -> None:
    """Translate generate_audio_user_speech_start → attempt_user_received_start."""
    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return
    item_id = data.get("item_id")
    if not item_id:
        return

    profile_id_str = await find_profile_by_socket(session.sid)

    await emit([
        internal_event(
            "attempt_user_received_start",
            AttemptUserReceivedStartData(
                sid=session.sid,
                chat_id=session.chat_id,
                run_id=session.run_id,
                profile_id=profile_id_str or "",
                item_id=item_id,
            ).model_dump(mode="json"),
        )
    ])


# ---------------------------------------------------------------------------
# generate_audio_user_speech_delta → attempt_user_received_progress
# ---------------------------------------------------------------------------


async def audio_speech_delta_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
) -> None:
    """Translate generate_audio_user_speech_delta → attempt_user_received_progress."""
    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return
    item_id = data.get("item_id")
    if not item_id:
        return

    await emit([
        internal_event(
            "attempt_user_received_progress",
            AttemptUserReceivedProgressData(
                sid=session.sid,
                chat_id=session.chat_id,
                item_id=item_id,
                transcript=data.get("transcript", ""),
            ).model_dump(mode="json"),
        )
    ])


# ---------------------------------------------------------------------------
# generate_audio_error → attempt_error
# ---------------------------------------------------------------------------


async def audio_error_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
) -> None:
    """Translate generate_audio_error → attempt_progress(type=error)."""
    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return
    await emit([
        internal_event(
            "attempt_error",
            AttemptErrorData(
                sid=session.sid,
                error_type="audio",
                message=data.get("error_message", "Unknown audio error"),
                chat_id=session.chat_id,
            ).model_dump(mode="json"),
        )
    ])


# ---------------------------------------------------------------------------
# attempt_next → attempt_proceed (delegation)
# ---------------------------------------------------------------------------


async def attempt_next_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
    attempt_id: str,
    group_id: str,
    draft_id: str | None,
) -> None:
    """Delegate attempt_next → attempt_proceed with force_proceed=True."""
    sid = data.get("sid", "")
    if not sid:
        return

    try:
        await emit([
            internal_event(
                "attempt_proceed",
                AttemptProceedData(
                    sid=sid,
                    attempt_id=attempt_id,
                    group_id=group_id,
                    draft_id=draft_id,
                    force_proceed=True,
                ).model_dump(mode="json"),
            )
        ])
    except Exception as e:
        logger.exception(f"Error in attempt_next: {e}")
        await emit([
            internal_event(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="next",
                    message=f"Failed to continue attempt: {e}",
                ).model_dump(mode="json"),
            )
        ])


# ---------------------------------------------------------------------------
# attempt_user_received_start → DB write → attempt_user_start
# ---------------------------------------------------------------------------


async def user_start_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
    conn: asyncpg.Connection,
) -> None:
    """Create user message shell and emit attempt_user_start."""
    sid = data.get("sid", "")
    chat_id = data.get("chat_id", "")
    run_id = data.get("run_id", "")
    if not sid or not chat_id or not run_id:
        return

    try:
        from app.routes.v5.tools.entries.messages.create import create_message

        result = await create_message(
            conn,
            run_id=uuid.UUID(run_id),
            role="user",
        )
        await conn.execute(
            """
            INSERT INTO attempt_message_entry (id, chat_id)
            VALUES ($1, $2)
        """,
            result.id,
            uuid.UUID(chat_id),
        )

        await emit([
            internal_event(
                "attempt_user_start",
                AttemptUserStartData(
                    sid=sid,
                    chat_id=chat_id,
                    message_id=str(result.id),
                    created_at=result.created_at.isoformat()
                    if result.created_at
                    else "",
                    item_id=data.get("item_id"),
                    rooms=data.get("rooms"),
                ).model_dump(mode="json"),
            )
        ])

    except Exception as e:
        logger.exception(f"Error in user_received_start: {e}")


# ---------------------------------------------------------------------------
# generate_audio_session_complete → cleanup → attempt_audio_ended
# ---------------------------------------------------------------------------


async def audio_stop_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
) -> None:
    """Clean up audio session and emit attempt_audio_ended."""
    from app.infra.websocket.audio_lifecycle import cleanup_audio_session

    sid = data.get("sid")
    group_id = data.get("group_id")
    if not sid:
        return

    session = get_session_by_group_id(group_id) if group_id else None
    chat_id = session.chat_id if session else (group_id or "")
    if session:
        await cleanup_audio_session(session)

    await emit([
        internal_event(
            "attempt_audio_ended",
            AttemptAudioEndedData(
                sid=sid,
                chat_id=chat_id,
                success=True,
                message="Voice session stopped",
            ).model_dump(mode="json"),
        )
    ])


# ---------------------------------------------------------------------------
# generate_audio_response_cancelled → attempt_stopped + generate
# ---------------------------------------------------------------------------


async def audio_response_cancelled_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
) -> None:
    """Handle barge-in cancellation: notify client + re-enter rate limit gate."""
    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return

    sid = session.sid
    chat_id = session.chat_id

    logger.info(f"Response cancelled (barge-in) - group_id={group_id}")

    await emit([
        internal_event(
            "attempt_stopped",
            AttemptStoppedData(
                sid=sid,
                rooms=[sid, f"attempt_{chat_id}"],
                chat_id=chat_id,
                success=True,
                message=None,
            ).model_dump(mode="json"),
        ),
        internal_event(
            "generate",
            {
                "sid": sid,
                "artifact_types": data.get("artifact_types")
                or [{"name": data.get("artifact_type", ""), "operation": "get"}],
                "group_id": group_id,
                "metadata": data.get("metadata", {}),
            },
        ),
    ])
