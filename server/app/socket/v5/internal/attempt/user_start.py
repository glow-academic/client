"""Internal handler: attempt_user_received_start → DB write → attempt_user_start.

Creates the user message shell (messages_entry + attempt_message_entry)
and emits attempt_user_start with the confirmed message_id.

Shared by both text and audio paths.
"""

import uuid
from typing import Any

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.internal.attempt.types import AttemptUserStartData
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

internal_sio = get_internal_sio()


@internal_sio.on("attempt_user_received_start")  # type: ignore
async def handle_user_received_start(data: dict[str, Any]) -> None:
    """Create user message shell and emit attempt_user_start."""
    sid = data.get("sid", "")
    chat_id = data.get("chat_id", "")
    run_id = data.get("run_id", "")
    if not sid or not chat_id or not run_id:
        return

    try:
        async with get_db_connection() as conn:
            created_at = await conn.fetchval("SELECT NOW()")

            # Create message shell (no content yet — that comes at complete)
            message_id = await conn.fetchval(
                """INSERT INTO messages_entry (run_id, role, created_at, updated_at)
                VALUES ($1, 'user'::message_type, $2, $2)
                RETURNING id""",
                uuid.UUID(run_id),
                created_at,
            )

            await conn.execute(
                """INSERT INTO attempt_message_entry (id, chat_id)
                VALUES ($1, $2)""",
                message_id,
                uuid.UUID(chat_id),
            )

        await internal_sio.emit(
            "attempt_user_start",
            AttemptUserStartData(
                sid=sid,
                chat_id=chat_id,
                message_id=str(message_id),
                created_at=created_at.isoformat() if created_at else "",
                item_id=data.get("item_id"),
                rooms=data.get("rooms"),
            ).model_dump(mode="json"),
        )

    except Exception as e:
        logger.exception(f"Error in user_received_start: {e}")
