"""Internal handler: attempt_user_received_start → DB write → attempt_user_start.

Creates the user message shell (messages_entry + attempt_message_entry)
and emits attempt_user_start with the confirmed message_id.

Shared by both text and audio paths.
"""

import uuid
from typing import Any

from app.routes.v5.api.entries.messages.create import create_messages_entry_internal
from app.infra.websocket.get_db_connection import get_db_connection
from app.globals import get_internal_sio
from app.routes.v5.socket.internal.attempt.types import AttemptUserStartData
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
            result = await create_messages_entry_internal(
                conn,
                run_id=uuid.UUID(run_id),
                role="user",
                chat_id=uuid.UUID(chat_id),
            )

        await internal_sio.emit(
            "attempt_user_start",
            AttemptUserStartData(
                sid=sid,
                chat_id=chat_id,
                message_id=str(result.id),
                created_at=result.created_at.isoformat() if result.created_at else "",
                item_id=data.get("item_id"),
                rooms=data.get("rooms"),
            ).model_dump(mode="json"),
        )

    except Exception as e:
        logger.exception(f"Error in user_received_start: {e}")
