"""Client-facing attempt_message handler.

Handles: attempt_message — send a user message in an attempt chat.

Flow:
1. Resolve group_id from attempt_chat_entry
2. Create run + profile link (config created by internal/generate.py)
3. Create user message (messages_entry + attempt_message_entry + attempt_content_entry)
4. Create assistant placeholder (messages_entry + attempt_message_entry)
5. Emit attempt_user_complete + attempt_assistant_start
6. Emit generate with pre-created run_id/group_id
"""

import uuid
from typing import Any

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v5.client.types import AttemptMessagePayload
from app.socket.v5.internal.attempt.types import (
    AttemptAssistantStartData,
    AttemptErrorData,
    AttemptUserCompleteData,
    GenerateRequestData,
)
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

# Hardcoded Student persona for user messages
STUDENT_PERSONA_ID = uuid.UUID("019bb25e-e60c-7352-9b81-f411f56092a9")


@sio.event  # type: ignore
async def attempt_message(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_message — prepare + emit generate."""
    try:
        payload = AttemptMessagePayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="send",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        attempt_id = payload.attempt_id
        chat_id = payload.chat_id
        message = payload.message

        if not message or not message.strip():
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="send",
                    message="Missing or empty message",
                    chat_id=str(chat_id),
                ).model_dump(mode="json"),
            )
            return

        async with get_db_connection() as conn:
            # Step 1: Resolve group_id from attempt_chat_entry
            group_id = await conn.fetchval(
                "SELECT group_id FROM attempt_chat_entry WHERE id = $1",
                chat_id,
            )

            if not group_id:
                await internal_sio.emit(
                    "attempt_error",
                    AttemptErrorData(
                        sid=sid,
                        error_type="send",
                        message="No group found for chat",
                        chat_id=str(chat_id),
                    ).model_dump(mode="json"),
                )
                return

            # Step 2: Create run + profile link (config created by internal/generate.py)
            run_id = await conn.fetchval(
                """INSERT INTO runs_entry (group_id)
                VALUES ($1) RETURNING id""",
                group_id,
            )

            await conn.execute(
                """INSERT INTO profiles_runs_connection (profiles_id, run_id)
                SELECT ppj.profiles_id, $2
                FROM profile_profiles_junction ppj
                WHERE ppj.profile_id = $1
                LIMIT 1""",
                profile_id,
                run_id,
            )

            # Step 3: Create user message
            created_at = await conn.fetchval("SELECT NOW()")

            user_message_id = await conn.fetchval(
                """INSERT INTO messages_entry (run_id, role, audio, created_at, updated_at)
                VALUES ($1, 'user'::message_type, $2, $3, $3)
                RETURNING id""",
                run_id,
                payload.voice_mode,
                created_at,
            )

            await conn.execute(
                """INSERT INTO messages_completions_entry (message_id)
                VALUES ($1)""",
                user_message_id,
            )

            await conn.execute(
                """INSERT INTO attempt_message_entry (id, chat_id)
                VALUES ($1, $2)""",
                user_message_id,
                chat_id,
            )

            await conn.execute(
                """INSERT INTO attempt_content_entry (message_id, content, persona_id)
                VALUES ($1, $2, $3)""",
                user_message_id,
                message,
                STUDENT_PERSONA_ID,
            )

            # Step 4: Create assistant placeholder (messages_entry + attempt_message_entry only)
            assistant_message_id = await conn.fetchval(
                """INSERT INTO messages_entry (run_id, role, audio, created_at, updated_at)
                VALUES ($1, 'assistant'::message_type, $2, $3 + interval '1 millisecond', $3 + interval '1 millisecond')
                RETURNING id""",
                run_id,
                payload.voice_mode,
                created_at,
            )

            await conn.execute(
                """INSERT INTO attempt_message_entry (id, chat_id)
                VALUES ($1, $2)""",
                assistant_message_id,
                chat_id,
            )

        created_at_str = created_at.isoformat() if created_at else ""

        # Step 5: Emit sync events
        await internal_sio.emit(
            "attempt_user_complete",
            AttemptUserCompleteData(
                sid=sid,
                rooms=[sid, f"attempt_{chat_id}"],
                chat_id=str(chat_id),
                message_id=str(user_message_id),
                content=message,
                created_at=created_at_str,
            ).model_dump(mode="json"),
        )

        await internal_sio.emit(
            "attempt_assistant_start",
            AttemptAssistantStartData(
                sid=sid,
                chat_id=str(chat_id),
                message_id=str(assistant_message_id),
                created_at=created_at_str,
            ).model_dump(mode="json"),
        )

        # Step 6: Emit to generate pipeline (pre-created run_id skips prepare)
        resource_types = payload.resource_types or ["contents", "hints"]

        await internal_sio.emit(
            "generate",
            GenerateRequestData(
                sid=sid,
                profile_id=str(profile_id),
                artifact_type="attempt",
                artifact_id=str(attempt_id),
                resource_types=resource_types,
                user_instructions=payload.user_instructions,
                save=True,
                run_id=str(run_id),
                group_id=str(group_id),
                metadata={
                    "attempt_id": str(attempt_id),
                    "chat_id": str(chat_id),
                },
            ).model_dump(mode="json"),
        )

        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="attempt.message.sent",
                template="{{ actor.name }} sent a message",
                context={"chat_id": str(chat_id)},
                endpoint="/socket/v5/attempt/message",
                error=False,
            )
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error in attempt_message: {e}")
        chat_id_str = str(data.get("chat_id", "")) if data.get("chat_id") else None
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="send",
                message=f"Failed to send message: {e}",
                chat_id=chat_id_str,
            ).model_dump(mode="json"),
        )
