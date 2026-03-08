"""Trivial attempt event translators — pure business logic with emit: EmitFn.

Each function receives raw event data, resolves context (session, profile),
and emits a translated event. No DB writes, no inline SQL.
"""

from __future__ import annotations

from typing import Any

from app.infra.websocket.attempt_types import (
    AttemptAssistantProgressData,
    AttemptAudioReadyData,
    AttemptErrorData,
    AttemptUserProgressData,
    AttemptUserReceivedProgressData,
    AttemptUserReceivedStartData,
)
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.session_store import get_session_by_group_id
from app.infra.websocket.socket_event import EmitFn, internal_event


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
