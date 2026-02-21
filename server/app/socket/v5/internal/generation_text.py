"""Handle text_complete events — save assistant messages to DB.

Replaces the duplicated _handle_{artifact}_text_complete across all 33 v4 handlers.
Listens on generate_text_complete for all artifact types.
"""

import uuid
from typing import Any

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/v4/queries/messages/create_message_with_text_complete.sql"
)


@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_text_complete(data: dict[str, Any]) -> None:
    """Save assistant message on text_complete (not run_complete — that's handled by generation_complete)."""
    event_type = data.get("event_type")
    if event_type != "text_complete":
        return

    run_id = data.get("run_id")
    final_content = data.get("text") or ""
    if not run_id or not final_content:
        return

    try:
        async with get_db_connection() as conn:
            create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)
            await conn.fetchval(
                create_message_sql,
                uuid.UUID(run_id),
                "assistant",
                final_content,
                True,
                False,
            )
    except Exception as e:
        logger.exception(f"Failed to save text_complete message: {e}")
