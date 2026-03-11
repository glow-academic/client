"""Shared attempt workflow logic, transport-agnostic apart from emitted payload shape."""

from __future__ import annotations

import uuid
from collections.abc import Awaitable, Callable
from typing import Any

import asyncpg
from redis.asyncio import Redis

from app.infra.websocket.attempt_types import (
    AttemptAssistantProgressData,
    AttemptAssistantStartData,
    AttemptAudioEndedData,
    AttemptAudioReadyData,
    AttemptErrorData,
    AttemptProceedData,
    AttemptStoppedData,
    AttemptUserProgressData,
    AttemptUserReceivedCompleteData,
    AttemptUserReceivedProgressData,
    AttemptUserReceivedStartData,
    AttemptUserCompleteData,
    AttemptUserStartData,
    GenerateRequestData,
)
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.infra.websocket.session_store import get_session_by_group_id
from app.infra.websocket.socket_event import EmitFn, internal_event
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

ResolveProfileIdentityFn = Callable[..., Awaitable[Any]]

GENERATE_FLAG_TO_RESOURCE = {
    "generate_problem_statements": "problem_statements",
    "generate_objectives": "objectives",
    "generate_videos": "videos",
    "generate_images": "images",
    "generate_questions": "questions",
    "generate_names": "names",
    "generate_descriptions": "descriptions",
    "generate_personas": "personas",
    "generate_documents": "documents",
    "generate_options": "options",
    "generate_parameter_fields": "parameter_fields",
}

GENERATE_FLAG_TO_CONNECTION = {
    "generate_personas": "personas_ids",
    "generate_problem_statements": "problem_statements_ids",
    "generate_objectives": "objectives_ids",
    "generate_questions": "questions_ids",
    "generate_options": "options_ids",
    "generate_videos": "videos_ids",
    "generate_images": "images_ids",
    "generate_documents": "documents_ids",
    "generate_parameter_fields": "parameter_fields_ids",
}


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

    await emit(
        [
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
        ]
    )


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
    await emit(
        [
            internal_event(
                "attempt_audio_ready",
                AttemptAudioReadyData(
                    sid=sid,
                    chat_id=chat_id,
                    success=True,
                    message="Voice session ready",
                ).model_dump(mode="json"),
            )
        ]
    )


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
    await emit(
        [
            internal_event(
                "attempt_assistant_progress",
                AttemptAssistantProgressData(
                    sid=session.sid,
                    chat_id=session.chat_id,
                    content_type="audio",
                    audio=audio_data,
                ).model_dump(mode="json"),
            )
        ]
    )


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
    session_id_str = await find_session_by_socket(session.sid)

    await emit(
        [
            internal_event(
                "attempt_user_received_start",
                AttemptUserReceivedStartData(
                    sid=session.sid,
                    chat_id=session.chat_id,
                    run_id=session.run_id,
                    profile_id=profile_id_str or "",
                    session_id=session_id_str,
                    item_id=item_id,
                ).model_dump(mode="json"),
            )
        ]
    )


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

    await emit(
        [
            internal_event(
                "attempt_user_received_progress",
                AttemptUserReceivedProgressData(
                    sid=session.sid,
                    chat_id=session.chat_id,
                    item_id=item_id,
                    transcript=data.get("transcript", ""),
                ).model_dump(mode="json"),
            )
        ]
    )


async def audio_error_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
) -> None:
    """Translate generate_audio_error → attempt_error."""
    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return
    await emit(
        [
            internal_event(
                "attempt_error",
                AttemptErrorData(
                    sid=session.sid,
                    error_type="audio",
                    message=data.get("error_message", "Unknown audio error"),
                    chat_id=session.chat_id,
                ).model_dump(mode="json"),
            )
        ]
    )


async def attempt_next_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
    attempt_id: str,
    draft_id: str | None,
    profile_id: str,
    session_id: str,
    pool: asyncpg.Pool,
    redis: Redis | None = None,
    resolve_profile_identity_fn: ResolveProfileIdentityFn | None = None,
) -> None:
    """Delegate attempt_next → attempt_proceed with force_proceed=True."""
    from app.infra.profile_identity_context import resolve_profile_identity_context

    sid = data.get("sid", "")
    if not sid:
        return

    try:
        resolve_profile_identity_fn = (
            resolve_profile_identity_fn or resolve_profile_identity_context
        )
        identity = await resolve_profile_identity_fn(
            pool,
            uuid.UUID(profile_id),
            redis or Redis(),
            session_id=uuid.UUID(session_id),
            attempt_id=uuid.UUID(attempt_id),
        )
        group_id = identity.group_id if identity else None
        if group_id is None:
            raise ValueError(f"Group not found for attempt {attempt_id}")

        await emit(
            [
                internal_event(
                    "attempt_proceed",
                    AttemptProceedData(
                        sid=sid,
                        attempt_id=attempt_id,
                        group_id=str(group_id),
                        draft_id=draft_id,
                        force_proceed=True,
                    ).model_dump(mode="json"),
                )
            ]
        )
    except Exception as e:
        logger.exception(f"Error in attempt_next: {e}")
        await emit(
            [
                internal_event(
                    "attempt_error",
                    AttemptErrorData(
                        sid=sid,
                        error_type="next",
                        message=f"Failed to continue attempt: {e}",
                    ).model_dump(mode="json"),
                )
            ]
        )


async def user_start_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
    pool: asyncpg.Pool,
) -> None:
    """Create user message shell and emit attempt_user_start."""
    sid = data.get("sid", "")
    chat_id = data.get("chat_id", "")
    run_id = data.get("run_id", "")
    session_id_str = data.get("session_id", "")
    if not sid or not chat_id or not run_id:
        return

    try:
        from app.routes.v5.tools.entries.attempt_message.create import (
            create_attempt_message,
        )
        from app.routes.v5.tools.entries.calls.create import create_call
        from app.routes.v5.tools.entries.messages.create import create_message

        run_id_uuid = uuid.UUID(run_id)
        session_id_uuid = uuid.UUID(session_id_str) if session_id_str else None

        async with pool.acquire() as conn:
            result = await create_message(
                conn,
                run_id=run_id_uuid,
                role="user",
            )
            call_result = await create_call(
                conn,
                run_id=run_id_uuid,
                session_id=session_id_uuid or uuid.UUID(int=0),
            )
            await create_attempt_message(
                conn,
                chat_id=uuid.UUID(chat_id),
                message_id=result.id,
                call_id=call_result.id,
            )

        await emit(
            [
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
            ]
        )

    except Exception as e:
        logger.exception(f"Error in user_received_start: {e}")


async def audio_stop_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
    cleanup_audio_session_fn: Callable[[Any], Awaitable[None]] | None = None,
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
        await (cleanup_audio_session_fn or cleanup_audio_session)(session)

    await emit(
        [
            internal_event(
                "attempt_audio_ended",
                AttemptAudioEndedData(
                    sid=sid,
                    chat_id=chat_id,
                    success=True,
                    message="Voice session stopped",
                ).model_dump(mode="json"),
            )
        ]
    )


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

    await emit(
        [
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
        ]
    )


async def user_complete_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
    pool: asyncpg.Pool,
) -> None:
    """Write content to open user message and emit attempt_user_complete."""
    from app.routes.v5.tools.entries.attempt_content.create import (
        create_attempt_content as create_attempt_content_entry_internal,
    )
    from app.routes.v5.tools.entries.attempt.search import search_attempts
    from app.routes.v5.tools.entries.attempt_message.search import (
        search_attempt_messages,
    )
    from app.routes.v5.tools.entries.attempt_message_completion.create import (
        create_attempt_message_completion,
    )

    sid = data.get("sid", "")
    chat_id = data.get("chat_id", "")
    run_id = data.get("run_id", "")
    session_id_str = data.get("session_id", "")
    content = data.get("content", "")
    if not sid or not chat_id or not run_id or not content:
        return

    try:
        from app.routes.v5.tools.entries.calls.create import create_call

        run_id_uuid = uuid.UUID(run_id)
        session_id_uuid = uuid.UUID(session_id_str) if session_id_str else None

        async with pool.acquire() as conn:
            messages, _ = await search_attempt_messages(
                conn,
                chat_ids=[uuid.UUID(chat_id)],
                bypass_mv=True,
                limit=1000,
            )

            open_user_messages = [
                m for m in messages if m.type == "query" and not m.completed
            ]

            if not open_user_messages:
                logger.warning(f"No open user message found for chat={chat_id}")
                return

            message = open_user_messages[0]
            message_id = message.message_id
            created_at = message.created_at
            attempts, _ = await search_attempts(
                conn,
                attempt_ids=[message.attempt_id],
                bypass_mv=True,
                limit=1,
            )
            if not attempts:
                logger.warning(f"No attempt found for chat={chat_id}")
                return

            user_persona_id = attempts[0].user_persona_id

            content_call = await create_call(
                conn,
                run_id=run_id_uuid,
                session_id=session_id_uuid or uuid.UUID(int=0),
            )

            await create_attempt_content_entry_internal(
                conn,
                message_id=message_id,
                call_id=content_call.id,
                content=content,
                persona_id=user_persona_id,
            )

            call_result = await create_call(
                conn,
                run_id=run_id_uuid,
                session_id=session_id_uuid or uuid.UUID(int=0),
            )
            await create_attempt_message_completion(
                conn,
                attempt_message_id=message_id,
                call_id=call_result.id,
            )

        await emit(
            [
                internal_event(
                    "attempt_user_complete",
                    AttemptUserCompleteData(
                        sid=sid,
                        chat_id=chat_id,
                        message_id=str(message_id),
                        content=content,
                        created_at=created_at.isoformat() if created_at else "",
                        item_id=data.get("item_id"),
                        rooms=data.get("rooms"),
                    ).model_dump(mode="json"),
                )
            ]
        )

    except Exception as e:
        logger.exception(f"Error in user_received_complete: {e}")


async def speech_complete_impl(
    data: dict[str, Any],
    *,
    emit: EmitFn,
    pool: asyncpg.Pool,
    session_id: uuid.UUID | None = None,
    audio_folder: str | None = None,
) -> None:
    """Save audio, create upload record, emit attempt_user_received_complete."""
    from pathlib import Path

    from app.infra.globals import AUDIO_FOLDER
    from app.routes.v5.tools.entries.uploads.create import create_upload

    group_id = data.get("group_id")
    if not group_id:
        return
    session = get_session_by_group_id(group_id)
    if not session:
        return

    transcript = data.get("transcript", "")
    if not transcript or not transcript.strip():
        return

    audio: bytes | None = data.get("audio")
    audio_upload_id: str | None = None
    if audio:
        try:
            file_uuid = uuid.uuid4()
            filename = f"{file_uuid}.pcm16"
            file_path = Path(audio_folder or AUDIO_FOLDER) / filename
            file_path.write_bytes(audio)

            relative_path = f"audio/{filename}"
            async with pool.acquire() as conn:
                upload_result = await create_upload(
                    conn,
                    session_id=session_id or uuid.UUID(int=0),
                    file_path=relative_path,
                    mime_type="audio/pcm16",
                    size=len(audio),
                )
            audio_upload_id = str(upload_result.id)
        except Exception as e:
            logger.exception(f"Failed to save user speech audio: {e}")

    await emit(
        [
            internal_event(
                "attempt_user_received_complete",
                AttemptUserReceivedCompleteData(
                    sid=session.sid,
                    chat_id=session.chat_id,
                    run_id=session.run_id,
                    content=transcript.strip(),
                    session_id=str(session_id) if session_id else None,
                    item_id=data.get("item_id"),
                    audio_upload_id=audio_upload_id,
                ).model_dump(mode="json"),
            )
        ]
    )
