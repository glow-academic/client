"""Attempt use previous handler.

Handles: attempt_use_previous — copy grades from a previous attempt's chats
by creating skipped chats with the same grades.
"""

import uuid
from typing import Any, cast

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v5.client.types import AttemptUsePreviousPayload
from app.sql.types import (
    UsePreviousAttemptGradesSqlParams,
    UsePreviousAttemptGradesSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_USE_PREVIOUS = (
    "app/sql/v4/queries/generate/attempt/use_previous_attempt_grades_complete.sql"
)


async def _attempt_use_previous_impl(sid: str, data: AttemptUsePreviousPayload) -> None:
    """Handle attempt_use_previous — create skipped chats with copied grades."""
    try:
        attempt_id = str(data.attempt_id)

        async with get_db_connection() as conn:
            last_chat_id: str | None = None

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
                                p_attempt_id=data.attempt_id,
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
            await conn.execute("REFRESH MATERIALIZED VIEW attempt_mv")
            await conn.execute("REFRESH MATERIALIZED VIEW attempt_chat_mv")

            # Emit attempt_chat_ended via server layer
            await internal_sio.emit(
                "attempt_chat_ended",
                {
                    "sid": sid,
                    "chat_id": last_chat_id or "",
                    "is_attempt_finished": None,
                    "grade_id": None,
                },
            )

        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="attempt.use_previous.ended",
                template="{{ actor.name }} used previous attempt grades",
                context={"attempt_id": attempt_id},
                endpoint="/socket/v5/attempt/use_previous",
                error=False,
            )
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error in attempt_use_previous: {e}")
        await internal_sio.emit(
            "attempt_error",
            {
                "sid": sid,
                "error_type": "end",
                "message": f"Failed to use previous grades: {e}",
            },
        )


@sio.event  # type: ignore
async def attempt_use_previous(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_use_previous event — copy grades from previous attempt."""
    try:
        payload = AttemptUsePreviousPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await internal_sio.emit(
                "attempt_error",
                {
                    "sid": sid,
                    "error_type": "end",
                    "message": "Profile not found. Please reconnect.",
                },
            )
            return

        await _attempt_use_previous_impl(sid, payload)

    except Exception as e:
        logger.exception(f"Invalid request in attempt_use_previous: {e}")
        await internal_sio.emit(
            "attempt_error",
            {
                "sid": sid,
                "error_type": "end",
                "message": f"Invalid request: {e}",
            },
        )
