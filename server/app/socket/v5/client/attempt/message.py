"""Client-facing attempt_message handler.

Handles: attempt_message — send a user message in an attempt chat.

Flow:
1. Validate + resolve profile, group_id
2. Create run + profile link
3. Emit attempt_user_received_start (internal handler creates message shell)
4. Emit attempt_user_received_complete (internal handler writes content + marks complete)
   (user_progress not needed for text — full message is known upfront)
5. Create assistant placeholder + emit attempt_assistant_start
6. Emit generate with pre-created run_id/group_id

All attempt_* emits go to internal bus → internal/ handlers (DB) → server/ handlers → client.
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
    AttemptUserReceivedCompleteData,
    AttemptUserReceivedStartData,
    GenerateRequestData,
)
from app.socket.v5.types import MESSAGE_ENTRY_TYPES
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


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

        rooms = [sid, f"attempt_{chat_id}"]

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

            # Step 2: Create run + profile link
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

        # Step 3: Emit user_received_start → internal handler creates message shell
        await internal_sio.emit(
            "attempt_user_received_start",
            AttemptUserReceivedStartData(
                sid=sid,
                chat_id=str(chat_id),
                run_id=str(run_id),
                profile_id=profile_id_str,
                rooms=rooms,
            ).model_dump(mode="json"),
        )

        # Step 4: Emit user_received_complete → internal handler writes content
        # (user_progress not needed for text — full message known upfront)
        await internal_sio.emit(
            "attempt_user_received_complete",
            AttemptUserReceivedCompleteData(
                sid=sid,
                chat_id=str(chat_id),
                run_id=str(run_id),
                content=message,
                rooms=rooms,
            ).model_dump(mode="json"),
        )

        # Step 5: Create assistant placeholder + emit assistant_start
        async with get_db_connection() as conn:
            created_at = await conn.fetchval("SELECT NOW()")

            assistant_message_id = await conn.fetchval(
                """INSERT INTO messages_entry (run_id, role, created_at, updated_at)
                VALUES ($1, 'assistant'::message_type, $2, $2)
                RETURNING id""",
                run_id,
                created_at,
            )

            await conn.execute(
                """INSERT INTO attempt_message_entry (id, chat_id)
                VALUES ($1, $2)""",
                assistant_message_id,
                chat_id,
            )

        await internal_sio.emit(
            "attempt_assistant_start",
            AttemptAssistantStartData(
                sid=sid,
                chat_id=str(chat_id),
                message_id=str(assistant_message_id),
                created_at=created_at.isoformat() if created_at else "",
            ).model_dump(mode="json"),
        )

        # Step 5b: Refresh attempt_message_mv so generate_prepare sees the new message
        async with get_db_connection() as conn:
            await conn.execute(
                "REFRESH MATERIALIZED VIEW CONCURRENTLY attempt_message_mv"
            )

        # Step 5c: Invalidate attempt caches so generate_prepare fetches fresh data
        await invalidate_tags(["attempt", "messages"])

        # Step 6: Emit to generate pipeline
        await internal_sio.emit(
            "generate",
            GenerateRequestData(
                sid=sid,
                profile_id=str(profile_id),
                artifact_type="attempt",
                artifact_id=str(attempt_id),
                resource_types=MESSAGE_ENTRY_TYPES,
                save=True,
                run_id=str(run_id),
                group_id=str(group_id),
                modality="call",
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
