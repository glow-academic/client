"""Attempt end all handler.

Handles WebSocket events for ending all chats:
- attempt_end_all: End all chats in an attempt
"""

from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import sio
from app.socket.v4.artifacts.attempt.types import (
    AttemptEndAllPayload,
    AttemptEndedEvent,
    AttemptUnifiedErrorEvent,
)
from app.sql.types import (
    EndAllAttemptChatsSqlParams,
    EndAllAttemptChatsSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_END_ALL = (
    "app/sql/v4/queries/generate/attempt/end_all_attempt_chats_complete.sql"
)


async def _attempt_end_all_impl(sid: str, data: AttemptEndAllPayload) -> None:
    """Handle attempt_end_all - end all remaining chats and create stubs for missing scenarios."""
    try:
        attempt_id = str(data.attempt_id)
        attempt_id_uuid = data.attempt_id

        async with get_db_connection() as conn:
            # End all chats and create stubs via typed SQL
            result_row = cast(
                EndAllAttemptChatsSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH_END_ALL,
                    params=EndAllAttemptChatsSqlParams(
                        p_attempt_id=attempt_id_uuid,
                    ),
                ),
            )

            logger.info(
                f"End all: completed={result_row.chats_completed if result_row else 0}, "
                f"stubs={result_row.stubs_created if result_row else 0}"
            )

            # Refresh MVs
            await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_list")
            await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_chats")

            # Emit attempt_ended event
            event = AttemptEndedEvent(
                attempt_id=attempt_id,
                success=True,
                message="All chats ended",
            )
            await sio.emit(
                "attempt_ended",
                event.model_dump(mode="json"),
                room=sid,
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="attempt.end_all.ended",
                    template="{{ actor.name }} ended all chats",
                    context={"attempt_id": attempt_id},
                    endpoint="/socket/v4/attempt/end_all",
                    error=False,
                )
            except Exception:
                pass

    except Exception as e:
        logger.exception(f"Error in attempt_end_all: {str(e)}")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=None,
                type="end",
                message=f"Failed to end all chats: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def attempt_end_all(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_end_all event - end all chats in an attempt."""
    try:
        payload = AttemptEndAllPayload(**data)
        await _attempt_end_all_impl(sid, payload)

    except Exception as e:
        logger.exception(f"Invalid request in attempt_end_all: {str(e)}")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=None,
                type="end",
                message=f"Invalid request: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/end_all", response_model=dict[str, bool])
async def attempt_end_all_api(request: AttemptEndAllPayload) -> dict[str, bool]:
    """Client-to-server event: End all chats in an attempt."""
    return {"success": True}


@server_router.post("/attempt/ended", response_model=dict[str, bool])
async def attempt_ended_api(request: AttemptEndedEvent) -> dict[str, bool]:
    """Server-to-client event: All chats ended."""
    return {"success": True}
