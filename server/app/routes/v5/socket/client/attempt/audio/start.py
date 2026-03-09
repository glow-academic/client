"""Client-facing attempt_audio_start handler.

Handles: attempt_audio_start — start a voice session for an attempt chat.

Flow:
1. Resolve group_id + attempt_id from attempt_chat_entry
2. Create run + call + conversation
3. Emit to generate pipeline with modality="audio"
"""

import uuid
from typing import Any

from app.infra.globals import get_internal_sio, get_pool, get_redis_client, sio
from app.infra.profile_identity_context import resolve_profile_identity_context
from app.infra.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.websocket.find_session_by_socket import find_session_by_socket
from app.routes.v5.socket.client.types import AttemptAudioStartPayload
from app.routes.v5.socket.internal.attempt.types import (
    AttemptErrorData,
    GenerateRequestData,
)
from app.routes.v5.tools.entries.attempt_chat.get import get_attempt_chats
from app.routes.v5.tools.entries.attempt_conversations.create import (
    create_attempt_conversations,
)
from app.routes.v5.tools.entries.calls.create import create_call
from app.routes.v5.tools.entries.runs.create import create_run
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@sio.event  # type: ignore
async def attempt_audio_start(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_audio_start — create run, emit generate with modality=audio."""
    try:
        payload = AttemptAudioStartPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        chat_id = payload.chat_id

        if not profile_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="audio",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
            )
            return

        profile_id = uuid.UUID(profile_id_str)

        session_id_str = await find_session_by_socket(sid)
        if not session_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="audio",
                    message="Session not found. Please reconnect.",
                    chat_id=str(chat_id),
                ).model_dump(mode="json"),
            )
            return

        session_id = uuid.UUID(session_id_str)
        pool = get_pool()
        identity = await resolve_profile_identity_context(
            pool, profile_id, get_redis_client(), session_id=session_id
        )
        profiles_id = identity.profiles_id if identity else None

        async with pool.acquire() as conn:
            # Step 1: Resolve group_id + attempt_id from attempt_chat_entry
            chat_entries = await get_attempt_chats(conn, [chat_id])

            if not chat_entries or not chat_entries[0].group_id:
                await internal_sio.emit(
                    "attempt_error",
                    AttemptErrorData(
                        sid=sid,
                        error_type="audio",
                        message="No group found for chat",
                        chat_id=str(chat_id),
                    ).model_dump(mode="json"),
                )
                return

            group_id = chat_entries[0].group_id
            attempt_id = chat_entries[0].attempt_id

            # Step 2: Create run + call + conversation
            run = await create_run(
                conn,
                group_id=group_id,
                session_id=session_id,
                profiles_id=profiles_id,
            )
            call = await create_call(conn, run_id=run.id, session_id=session_id)
            conversation = await create_attempt_conversations(
                conn,
                chat_id=chat_id,
                call_id=call.id,
                run_id=run.id,
            )

        # Step 3: Emit to generate pipeline with modality=audio
        resource_types = ["contents", "hints"]

        await internal_sio.emit(
            "generate",
            GenerateRequestData(
                sid=sid,
                profile_id=profile_id_str,
                artifact_types=[{"name": "attempt", "operation": "get"}],
                artifact_id=str(attempt_id),
                resource_types=resource_types,
                save=True,
                run_id=str(run.id),
                group_id=str(group_id),
                modality="audio",
                metadata={
                    "attempt_id": str(attempt_id),
                    "chat_id": str(chat_id),
                    "conversation_id": str(conversation.id),
                },
            ).model_dump(mode="json"),
        )

    except Exception as e:
        logger.exception(f"Error in attempt_audio_start: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="audio",
                message=f"Failed to start voice session: {e}",
            ).model_dump(mode="json"),
        )
