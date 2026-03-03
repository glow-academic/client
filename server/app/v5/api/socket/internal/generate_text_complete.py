"""Handle generate_text_complete — text generation finalized.

Saves assistant message to DB on text_complete. Run-level completion
(tokens, auto-save, multi-agent) is handled by generate_run_complete.
"""

import uuid
from typing import Any

from app.utils.storage.file_writer import write_text_file
from app.infra.websocket.get_db_connection import get_db_connection
from app.globals import get_internal_sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_CREATE_MESSAGE_WITH_TEXT = (
    "app/sql/queries/messages/create_message_with_text_complete.sql"
)


@internal_sio.on("generate_text_complete")  # type: ignore
async def handle_text_complete(data: dict[str, Any]) -> None:
    """Save assistant message on text_complete."""
    event_type = data.get("event_type")
    if event_type != "text_complete":
        return

    run_id = data.get("run_id")
    final_content = data.get("text") or ""
    if not run_id or not final_content:
        return

    try:
        async with get_db_connection() as conn:
            upload_id = await write_text_file(conn, None, final_content)
            create_message_sql = load_sql(SQL_PATH_CREATE_MESSAGE_WITH_TEXT)
            await conn.fetchval(
                create_message_sql,
                uuid.UUID(run_id),
                "assistant",
                upload_id,
                True,
            )
    except Exception as e:
        logger.exception(f"Failed to save text_complete message: {e}")
