"""Attempt stop handler.

Handles WebSocket events for stopping message generation:
- attempt_stop: Stop message generation
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.cancel_active_run import cancel_active_run
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import sio
from app.socket.v4.artifacts.attempt.types import (
    AttemptStopPayload,
    AttemptStoppedEvent,
    AttemptUnifiedErrorEvent,
)
from app.sql.types import SimulationTextStopRunSqlParams, SimulationTextStopRunSqlRow
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_STOP = "app/sql/v4/queries/simulations/simulation_text_stop_run_complete.sql"


async def _attempt_stop_impl(sid: str, data: AttemptStopPayload) -> None:
    """Handle attempt_stop - cancel active generation and mark message complete."""
    try:
        chat_id = str(data.chat_id)

        if not chat_id:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    chat_id=None,
                    type="stop",
                    message="Missing chat_id",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        async with get_db_connection() as conn:
            # Try immediate in-process cancel first
            from app.infra.v4.websocket.cancel_active_result import cancel_active_result

            await cancel_active_result(chat_id)
            # Then set cooperative cancel flag (Redis)
            await cancel_active_run(chat_id)

            # Stop simulation and mark message complete using typed SQL
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
                # Emit attempt_stopped event
                await sio.emit(
                    "attempt_stopped",
                    AttemptStoppedEvent(
                        chat_id=chat_id,
                        success=True,
                        message=None,
                    ).model_dump(mode="json"),
                    room=sid,
                )
                # Also emit to attempt room for multi-tab sync
                await sio.emit(
                    "attempt_stopped",
                    AttemptStoppedEvent(
                        chat_id=chat_id,
                        success=True,
                        message=None,
                    ).model_dump(mode="json"),
                    room=f"attempt_{chat_id}",
                )

                # Log activity
                try:
                    await log_websocket_activity(
                        sid=sid,
                        event_key="attempt.stop.stopped",
                        template="{{ actor.name }} stopped attempt",
                        context={"chat_id": chat_id},
                        endpoint="/socket/v4/attempt/stop",
                        error=False,
                    )
                except Exception:
                    pass
            else:
                await sio.emit(
                    "attempt_stopped",
                    AttemptStoppedEvent(
                        chat_id=chat_id,
                        success=False,
                        message="No active message found for this chat",
                    ).model_dump(mode="json"),
                    room=sid,
                )

    except Exception as e:
        logger.exception(f"Error in attempt_stop: {str(e)}")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=str(data.chat_id) if data else None,
                type="stop",
                message=f"Failed to stop: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def attempt_stop(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_stop event - stop message generation."""
    try:
        payload = AttemptStopPayload(**data)
        await _attempt_stop_impl(sid, payload)
    except Exception as e:
        logger.exception(f"Invalid request in attempt_stop: {str(e)}")
        chat_id = data.get("chat_id", "")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=str(chat_id) if chat_id else None,
                type="stop",
                message=f"Invalid request: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/stop", response_model=dict[str, bool])
async def attempt_stop_api(request: AttemptStopPayload) -> dict[str, bool]:
    """Client-to-server event: Stop message generation."""
    return {"success": True}


@server_router.post("/attempt/stopped", response_model=dict[str, bool])
async def attempt_stopped_api(request: AttemptStoppedEvent) -> dict[str, bool]:
    """Server-to-client event: Message generation stopped."""
    return {"success": True}
