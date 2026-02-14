"""Attempt end handler.

Handles WebSocket events for ending chats:
- attempt_end: End current chat and move to next
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import sio
from app.socket.v4.artifacts.attempt.types import (
    AttemptChatEndedEvent,
    AttemptEndPayload,
    AttemptUnifiedErrorEvent,
)
from app.sql.types import (
    EndAttemptChatSqlParams,
    EndAttemptChatSqlRow,
    UsePreviousAttemptGradesSqlParams,
    UsePreviousAttemptGradesSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_END_CHAT = "app/sql/v4/queries/generate/attempt/end_attempt_chat_complete.sql"
SQL_PATH_USE_PREVIOUS = (
    "app/sql/v4/queries/generate/attempt/use_previous_attempt_grades_complete.sql"
)


async def _attempt_end_impl(
    sid: str, data: AttemptEndPayload, profile_id: uuid.UUID
) -> None:
    """Handle attempt_end - end specific chats with optional grade copying.

    Two modes:
    1. Single chat end: { attempt_id, chat_id } — marks one chat as completed
    2. Use Previous: { attempt_id, previous_chat_map } — creates skipped chats
       with copied grades from previous attempt
    """
    try:
        attempt_id = str(data.attempt_id)
        attempt_id_uuid = data.attempt_id

        if not data.chat_id and not data.previous_chat_map:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    chat_id=None,
                    type="end",
                    message="Must provide chat_id or previous_chat_map",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        async with get_db_connection() as conn:
            last_chat_id: str | None = None

            # Mode 1: Single chat end (End Session with 0 messages)
            if data.chat_id:
                end_row = cast(
                    EndAttemptChatSqlRow,
                    await execute_sql_typed(
                        conn,
                        SQL_PATH_END_CHAT,
                        params=EndAttemptChatSqlParams(
                            p_attempt_id=attempt_id_uuid,
                            p_chat_id=data.chat_id,
                        ),
                    ),
                )

                if not end_row or not end_row.success:
                    await sio.emit(
                        "attempt_error",
                        AttemptUnifiedErrorEvent(
                            chat_id=str(data.chat_id),
                            type="end",
                            message="Chat not found",
                        ).model_dump(mode="json"),
                        room=sid,
                    )
                    return

                last_chat_id = str(end_row.chat_id) if end_row.chat_id else None

            # Mode 2: Use Previous — create skipped chats with copied grades
            if data.previous_chat_map:
                for scenario_id_str, prev_chat_id_str in data.previous_chat_map.items():
                    if not prev_chat_id_str:
                        continue
                    try:
                        prev_chat_uuid = uuid.UUID(prev_chat_id_str)
                        prev_scenario_uuid = uuid.UUID(scenario_id_str)

                        result_row = cast(
                            UsePreviousAttemptGradesSqlRow,
                            await execute_sql_typed(
                                conn,
                                SQL_PATH_USE_PREVIOUS,
                                params=UsePreviousAttemptGradesSqlParams(
                                    p_attempt_id=attempt_id_uuid,
                                    p_scenario_id=prev_scenario_uuid,
                                    p_previous_chat_id=prev_chat_uuid,
                                ),
                            ),
                        )

                        if result_row and result_row.skipped_chat_id:
                            last_chat_id = str(result_row.skipped_chat_id)

                    except Exception as e:
                        logger.warning(
                            f"Failed to create skipped chat for scenario "
                            f"{scenario_id_str}: {e}"
                        )
                        continue

            # Refresh MVs so changes are immediately visible
            await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_list")
            await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_chats")

            # Emit attempt_chat_ended event
            event = AttemptChatEndedEvent(
                chat_id=last_chat_id or "",
                is_attempt_finished=None,
                grade_id=None,
            )
            await sio.emit(
                "attempt_chat_ended",
                event.model_dump(mode="json"),
                room=sid,
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="attempt.end.ended",
                    template="{{ actor.name }} ended chat",
                    context={"attempt_id": attempt_id},
                    endpoint="/socket/v4/attempt/end",
                    error=False,
                )
            except Exception:
                pass

    except Exception as e:
        logger.exception(f"Error in attempt_end: {str(e)}")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=None,
                type="end",
                message=f"Failed to end chat: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def attempt_end(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_end event - end specific chats or use previous grades."""
    try:
        payload = AttemptEndPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    chat_id=None,
                    type="end",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        await _attempt_end_impl(sid, payload, profile_id)

    except Exception as e:
        logger.exception(f"Invalid request in attempt_end: {str(e)}")
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


@client_router.post("/attempt/end", response_model=dict[str, bool])
async def attempt_end_api(request: AttemptEndPayload) -> dict[str, bool]:
    """Client-to-server event: End current chat."""
    return {"success": True}


@server_router.post("/attempt/chat_ended", response_model=dict[str, bool])
async def attempt_chat_ended_api(request: AttemptChatEndedEvent) -> dict[str, bool]:
    """Server-to-client event: Chat ended."""
    return {"success": True}
