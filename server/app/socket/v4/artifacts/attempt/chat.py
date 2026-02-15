"""Attempt chat lifecycle handler.

Handles attempt_chat internal event. Dual-mode:
- Create mode (no completed_chat_ids): Create chat via SQL, emit attempt_chat_started
- Complete mode (has completed_chat_ids): Mark chats completed, emit attempt_chat_ended,
  and optionally auto-proceed
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.attempt.types import (
    AttemptChatEndedEvent,
    AttemptChatStartedEvent,
    AttemptUnifiedErrorEvent,
)
from app.sql.types import (
    CreateAttemptChatSqlParams,
    CreateAttemptChatSqlRow,
    EndAttemptChatSqlParams,
    EndAttemptChatSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

server_router = APIRouter()

SHOULD_PROCEED = True

SQL_PATH_CREATE_CHAT = (
    "app/sql/v4/queries/generate/attempt/create_attempt_chat_complete.sql"
)
SQL_PATH_END_CHAT = "app/sql/v4/queries/generate/attempt/end_attempt_chat_complete.sql"


async def _attempt_chat_impl(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_chat - create or complete chats."""
    try:
        attempt_id_str = data.get("attempt_id")
        completed_chat_ids = data.get("completed_chat_ids")
        profile_id_str = data.get("profile_id") or await find_profile_by_socket(sid)

        if not attempt_id_str:
            logger.warning("attempt_chat: missing attempt_id")
            return

        attempt_id = uuid.UUID(attempt_id_str)

        if completed_chat_ids:
            # === COMPLETE MODE ===
            async with get_db_connection() as conn:
                last_chat_id: str | None = None

                for chat_id_str in completed_chat_ids:
                    chat_id = uuid.UUID(chat_id_str)
                    end_row = cast(
                        EndAttemptChatSqlRow,
                        await execute_sql_typed(
                            conn,
                            SQL_PATH_END_CHAT,
                            params=EndAttemptChatSqlParams(
                                p_attempt_id=attempt_id,
                                p_chat_id=chat_id,
                            ),
                        ),
                    )

                    if end_row and end_row.success:
                        last_chat_id = (
                            str(end_row.chat_id) if end_row.chat_id else chat_id_str
                        )

                # Refresh MVs
                await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_list")
                await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_chats")

            # Emit attempt_chat_ended to client
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

            # Auto-proceed: emit attempt_start in Next mode
            if SHOULD_PROCEED:
                await internal_sio.emit(
                    "attempt_start",
                    {
                        "sid": sid,
                        "attempt_id": str(attempt_id),
                    },
                )

        else:
            # === CREATE MODE ===
            training_bundle_department_id_str = data.get(
                "training_bundle_department_id"
            )
            if not profile_id_str or not training_bundle_department_id_str:
                logger.warning(
                    "attempt_chat create mode: missing profile_id or training_bundle_department_id"
                )
                return

            profile_id = uuid.UUID(profile_id_str)
            training_bundle_department_id = uuid.UUID(training_bundle_department_id_str)

            async with get_db_connection() as conn:
                chat_row = cast(
                    CreateAttemptChatSqlRow,
                    await execute_sql_typed(
                        conn,
                        SQL_PATH_CREATE_CHAT,
                        params=CreateAttemptChatSqlParams(
                            p_profile_id=profile_id,
                            p_attempt_id=attempt_id,
                            p_training_bundle_department_id=training_bundle_department_id,
                        ),
                    ),
                )

                if not chat_row or not chat_row.chat_id:
                    logger.error(f"Failed to create chat for attempt {attempt_id}")
                    return

                chat_id = chat_row.chat_id

                # Refresh MVs
                await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_list")
                await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_chats")

            await invalidate_tags(["attempt", "attempts"])

            # Emit attempt_chat_started to client
            event = AttemptChatStartedEvent(
                attempt_id=str(attempt_id),
                chat_id=str(chat_id),
            )
            await sio.emit(
                "attempt_chat_started",
                event.model_dump(mode="json"),
                room=sid,
            )

    except Exception as e:
        logger.exception(f"Error in attempt_chat: {str(e)}")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                type="chat",
                message=f"Failed to handle chat lifecycle: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@internal_sio.on("attempt_chat")  # type: ignore
async def attempt_chat_handler(data: dict[str, Any]) -> None:
    """Handle attempt_chat from internal bus."""
    sid = data.get("sid", "")
    if not sid:
        return

    await _attempt_chat_impl(sid, data)


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@server_router.post("/attempt/chat_started", response_model=dict[str, bool])
async def attempt_chat_started_api(
    request: AttemptChatStartedEvent,
) -> dict[str, bool]:
    """Server-to-client event: Chat created within an attempt."""
    return {"success": True}
