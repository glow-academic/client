"""Attempt end all handler.

Handles: attempt_end_all — end all remaining chats in an attempt and create
stubs for missing scenarios.
"""

from typing import Any, cast

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v5.client.types import AttemptEndAllPayload
from app.sql.types import EndAllAttemptChatsSqlParams, EndAllAttemptChatsSqlRow
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_END_ALL = (
    "app/sql/v4/queries/generate/attempt/end_all_attempt_chats_complete.sql"
)


async def _attempt_end_all_impl(sid: str, data: AttemptEndAllPayload) -> None:
    """Handle attempt_end_all — end all remaining chats and create stubs."""
    try:
        attempt_id = str(data.attempt_id)

        async with get_db_connection() as conn:
            result_row = cast(
                EndAllAttemptChatsSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH_END_ALL,
                    params=EndAllAttemptChatsSqlParams(
                        p_attempt_id=data.attempt_id,
                    ),
                ),
            )

            logger.info(
                f"End all: completed={result_row.chats_completed if result_row else 0}, "
                f"stubs={result_row.stubs_created if result_row else 0}"
            )

            # Refresh MVs
            await conn.execute("REFRESH MATERIALIZED VIEW attempt_mv")
            await conn.execute("REFRESH MATERIALIZED VIEW attempt_chat_mv")

            # Emit attempt_ended via server layer
            await internal_sio.emit(
                "attempt_ended",
                {
                    "sid": sid,
                    "attempt_id": attempt_id,
                    "success": True,
                    "message": "All chats ended",
                },
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="attempt.end_all.ended",
                    template="{{ actor.name }} ended all chats",
                    context={"attempt_id": attempt_id},
                    endpoint="/socket/v5/attempt/end_all",
                    error=False,
                )
            except Exception:
                pass

    except Exception as e:
        logger.exception(f"Error in attempt_end_all: {e}")
        await internal_sio.emit(
            "attempt_error",
            {
                "sid": sid,
                "error_type": "end",
                "message": f"Failed to end all chats: {e}",
            },
        )


@sio.event  # type: ignore
async def attempt_end_all(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_end_all event — end all chats in an attempt."""
    try:
        payload = AttemptEndAllPayload(**data)
        await _attempt_end_all_impl(sid, payload)

    except Exception as e:
        logger.exception(f"Invalid request in attempt_end_all: {e}")
        await internal_sio.emit(
            "attempt_error",
            {
                "sid": sid,
                "error_type": "end",
                "message": f"Invalid request: {e}",
            },
        )
