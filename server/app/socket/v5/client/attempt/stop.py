"""Attempt stop handler.

Handles: attempt_stop_message — stop active message generation.

Dual cancel (in-process + Redis) → SQL mutation → emit stopped.
"""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.cancel_active_result import cancel_active_result
from app.infra.v4.websocket.cancel_active_run import cancel_active_run
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v5.client.types import AttemptStopPayload
from app.socket.v5.internal.attempt.types import AttemptErrorData, AttemptStoppedData
from app.sql.types import SimulationTextStopRunSqlParams, SimulationTextStopRunSqlRow
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_STOP = "app/sql/v4/queries/simulations/simulation_text_stop_run_complete.sql"


async def _attempt_stop_impl(sid: str, data: AttemptStopPayload) -> None:
    """Handle attempt_stop_message — cancel active generation and mark complete."""
    try:
        chat_id = str(data.chat_id)

        # Step 1: In-process cancel
        await cancel_active_result(chat_id)

        # Step 2: Redis cooperative cancel
        await cancel_active_run(chat_id)

        # Step 3: SQL mutation — mark message complete
        async with get_db_connection() as conn:
            row = cast(
                SimulationTextStopRunSqlRow,
                await execute_sql_typed(
                    conn,
                    SQL_PATH_STOP,
                    params=SimulationTextStopRunSqlParams(chat_id=uuid.UUID(chat_id)),
                ),
            )

        success = row.success if row else False
        cancelled_message_id = row.cancelled_message_id if row else None

        if success and cancelled_message_id:
            # Emit to sid + attempt room via server layer
            await internal_sio.emit(
                "attempt_stopped",
                AttemptStoppedData(
                    sid=sid,
                    rooms=[sid, f"attempt_{chat_id}"],
                    chat_id=chat_id,
                    success=True,
                    message=None,
                ).model_dump(mode="json"),
            )

            # Log activity
            try:
                pass
            except Exception:
                pass
        else:
            await internal_sio.emit(
                "attempt_stopped",
                AttemptStoppedData(
                    sid=sid,
                    chat_id=chat_id,
                    success=False,
                    message="No active message found for this chat",
                ).model_dump(mode="json"),
            )

    except Exception as e:
        logger.exception(f"Error in attempt_stop_message: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="stop",
                message=f"Failed to stop: {e}",
                chat_id=str(data.chat_id) if data else None,
            ).model_dump(mode="json"),
        )


@sio.event  # type: ignore
async def attempt_stop_message(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_stop_message event — stop message generation."""
    try:
        payload = AttemptStopPayload(**data)
        await _attempt_stop_impl(sid, payload)
    except Exception as e:
        logger.exception(f"Invalid request in attempt_stop_message: {e}")
        chat_id = data.get("chat_id", "")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="stop",
                message=f"Invalid request: {e}",
                chat_id=str(chat_id) if chat_id else None,
            ).model_dump(mode="json"),
        )
