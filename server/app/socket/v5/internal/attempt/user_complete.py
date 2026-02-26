"""Internal handler: attempt_user_received_complete → DB write → attempt_user_complete.

Finds the open (uncompleted) user message for the chat+run,
writes the content, marks it complete, and emits attempt_user_complete.

Shared by both text and audio paths.
"""

import uuid
from typing import Any

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.internal.attempt.types import AttemptUserCompleteData
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
            await conn.execute(
                """INSERT INTO attempt_content_entry (message_id, content, persona_id)
                VALUES ($1, $2, $3)""",
                message_id,
                content,
                STUDENT_PERSONA_ID,
            )

            # Mark message as complete
            await conn.execute(
                """INSERT INTO messages_completions_entry (message_id)
                VALUES ($1)""",
                message_id,
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
