"""Internal handler: attempt_user_received_complete → DB write → attempt_user_complete.

Finds the open (uncompleted) user message for the chat+run,
writes the content, marks it complete, and emits attempt_user_complete.

Shared by both text and audio paths.
"""

import uuid
from typing import Any

from app.v5.api.entries.attempt_content.create import (
    create_attempt_content_entry_internal,
)
from app.v5.api.entries.messages_completions.create import (
    create_messages_completions_entry_internal,
)
from app.v5.infra.websocket.get_db_connection import get_db_connection
from app.globals import get_internal_sio
from app.v5.api.socket.internal.attempt.types import AttemptUserCompleteData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()

# Hardcoded Student persona for user messages
STUDENT_PERSONA_ID = uuid.UUID("019bb25e-e60c-7352-9b81-f411f56092a9")


@internal_sio.on("attempt_user_received_complete")  # type: ignore
async def handle_user_received_complete(data: dict[str, Any]) -> None:
    """Write content to open user message and emit attempt_user_complete."""
    sid = data.get("sid", "")
    chat_id = data.get("chat_id", "")
    run_id = data.get("run_id", "")
    content = data.get("content", "")
    if not sid or not chat_id or not run_id or not content:
        return

    try:
        async with get_db_connection() as conn:
            # Find the open (uncompleted) user message for this chat + run
            # Cross-table query across messages_entry + attempt_message_entry + messages_completions_entry
            row = await conn.fetchrow(
                """SELECT me.id, me.created_at
                FROM messages_entry me
                JOIN attempt_message_entry ame ON ame.id = me.id
                WHERE ame.chat_id = $1
                  AND me.run_id = $2
                  AND me.role = 'user'::message_type
                  AND NOT EXISTS (
                      SELECT 1 FROM messages_completions_entry mce
                      WHERE mce.message_id = me.id
                  )
                ORDER BY me.created_at DESC
                LIMIT 1""",
                uuid.UUID(chat_id),
                uuid.UUID(run_id),
            )

            if not row:
                logger.warning(
                    f"No open user message found for chat={chat_id} run={run_id}"
                )
                return

            message_id = row["id"]
            created_at = row["created_at"]

            # Write content
            await create_attempt_content_entry_internal(
                conn,
                {
                    "message_id": message_id,
                    "content": content,
                    "persona_id": STUDENT_PERSONA_ID,
                },
                run_id=uuid.UUID(run_id),
            )

            # Link audio upload if present (audios → audio_uploads → message_audios)
            audio_upload_id = data.get("audio_upload_id")
            if audio_upload_id:
                audio_id = await conn.fetchval(
                    """INSERT INTO audios (created_at, updated_at, active, generated, call_id)
                    VALUES (NOW(), NOW(), true, false, NULL)
                    RETURNING id""",
                )
                await conn.execute(
                    """INSERT INTO audio_uploads (audio_id, upload_id, active, created_at, updated_at)
                    VALUES ($1, $2, true, NOW(), NOW())""",
                    audio_id,
                    uuid.UUID(audio_upload_id),
                )
                await conn.execute(
                    """INSERT INTO message_audios (message_id, audio_id, created_at, updated_at)
                    VALUES ($1, $2, NOW(), NOW())""",
                    message_id,
                    audio_id,
                )

            # Mark message as complete
            await create_messages_completions_entry_internal(
                conn,
                message_id=message_id,
            )

        await internal_sio.emit(
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

    except Exception as e:
        logger.exception(f"Error in user_received_complete: {e}")
