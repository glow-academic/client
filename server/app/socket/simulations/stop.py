"""Handler for stop_simulation WebSocket event."""

import logging
from typing import Any

from pydantic import BaseModel, ValidationError

from app.main import get_pool, sio
from app.utils.sql_helper import load_sql
from app.utils.websocket.cancel_active_run import cancel_active_run

logger = logging.getLogger(__name__)


# Pydantic models for server-to-client events
class StopSimulationErrorPayload(BaseModel):
    success: bool
    message: str


class SimulationMessageCancelledPayload(BaseModel):
    message_id: str
    chat_id: str
    final_content: str


class SimulationStoppedPayload(BaseModel):
    chat_id: str
    success: bool
    message: str


# Pydantic model for client-to-server event
class StopSimulationPayload(BaseModel):
    chat_id: str


# Emit helper functions
async def stop_simulation_error(payload: StopSimulationErrorPayload, room: str) -> None:
    await sio.emit("stop_simulation_error", payload.model_dump(), room=room)


async def simulation_message_cancelled(
    payload: SimulationMessageCancelledPayload, room: str
) -> None:
    await sio.emit("simulation_message_cancelled", payload.model_dump(), room=room)


async def simulation_stopped(payload: SimulationStoppedPayload, room: str) -> None:
    await sio.emit("simulation_stopped", payload.model_dump(), room=room)


async def _stop_simulation_impl(sid: str, data: StopSimulationPayload) -> None:
    """
    Handle simulation stop requests via WebSocket
    Replaces /simulations/stop endpoint
    """
    try:
        chat_id = data.chat_id

        if not chat_id:
            await stop_simulation_error(
                StopSimulationErrorPayload(success=False, message="Missing chat_id"),
                room=sid,
            )
            logger.error(f"Emitted error to {sid}: Missing chat_id")
            return

        # Get connection pool
        pool = get_pool()
        if not pool:
            await stop_simulation_error(
                StopSimulationErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            logger.error(
                f"Emitted error to {sid}: Database connection pool not available"
            )
            return

        async with pool.acquire() as conn:
            # Attempt to cancel the simulation run and the in-process Runner immediately
            from app.utils.websocket.cancel_active_result import cancel_active_result

            # Try immediate in-process cancel first
            await cancel_active_result(str(chat_id))
            # Then set cooperative cancel flag (Redis) - inlined cancel_simulation_run
            await cancel_active_run(str(chat_id))

            # Stop simulation and mark message complete using SQL
            sql = load_sql("sql/v3/simulations/stop_simulation_run_complete.sql")
            row = await conn.fetchrow(sql, chat_id)

            if not row:
                result = {
                    "success": False,
                    "cancelled_message_id": None,
                    "final_content": "",
                }
            else:
                result = {
                    "success": row["success"],
                    "cancelled_message_id": row["cancelled_message_id"],
                    "final_content": row["final_content"],
                }

            if result["success"] and result["cancelled_message_id"]:
                logger.info(f"Successfully cancelled simulation run for chat {chat_id}")

                # Emit a cancellation / final content event so clients update UI
                await simulation_message_cancelled(
                    SimulationMessageCancelledPayload(
                        message_id=str(result["cancelled_message_id"]),
                        chat_id=str(chat_id),
                        final_content=str(result["final_content"])
                        if result["final_content"]
                        else "",
                    ),
                    room=f"simulation_{chat_id}",
                )

                # Emit stop signal
                await simulation_stopped(
                    SimulationStoppedPayload(
                        chat_id=chat_id,
                        success=True,
                        message="",  # Empty message, no toast
                    ),
                    room=f"simulation_{chat_id}",
                )

            else:
                logger.warning(f"No active simulation run found for chat {chat_id}")
                await simulation_stopped(
                    SimulationStoppedPayload(
                        chat_id=chat_id,
                        success=False,
                        message="No active message found for this chat",
                    ),
                    room=f"simulation_{chat_id}",
                )

    except Exception as e:
        logger.error(f"Error stopping simulation for {sid}: {str(e)}")
        await stop_simulation_error(
            StopSimulationErrorPayload(
                success=False, message=f"Failed to stop simulation: {str(e)}"
            ),
            room=sid,
        )
        logger.error(f"Emitted error to {sid}: Failed to stop simulation: {str(e)}")


@sio.event  # type: ignore
async def stop_simulation(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = StopSimulationPayload(**data)
        await _stop_simulation_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in stop_simulation for {sid}: {e}")
        await stop_simulation_error(
            StopSimulationErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
