"""Handler for stop_simulation WebSocket event."""

import logging
from typing import Any

import socketio  # type: ignore
from app.main import get_pool
from app.main import sio
from app.utils.sql_helper import load_sql
from app.utils.websocket_utils import cancel_active_run

logger = logging.getLogger(__name__)


@sio.event  # type: ignore
async def stop_simulation(sid: str, data: dict[str, Any]) -> None:
    """
    Handle simulation stop requests via WebSocket
    Replaces /simulations/stop endpoint
    """
    try:
        chat_id = data.get("chat_id")

        if not chat_id:
            await sio.emit(
                "simulation_error",
                {"success": False, "message": "Missing chat_id"},
                room=sid,
            )
            logger.error(f"Emitted error to {sid}: Missing chat_id")
            return

        # Get connection pool
        pool = get_pool()
        if not pool:
            await sio.emit(
                "simulation_error",
                {"success": False, "message": "Database connection pool not available"},
                room=sid,
            )
            logger.error(
                f"Emitted error to {sid}: Database connection pool not available"
            )
            return

        async with pool.acquire() as conn:
            # Attempt to cancel the simulation run and the in-process Runner immediately
            from app.utils.websocket_utils import cancel_active_result

            # Try immediate in-process cancel first
            immediate = await cancel_active_result(str(chat_id))
            # Then set cooperative cancel flag (Redis) - inlined cancel_simulation_run
            success = await cancel_active_run(str(chat_id))

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
                await sio.emit(
                    "simulation_message_cancelled",
                    {
                        "message_id": str(result["cancelled_message_id"]),
                        "chat_id": str(chat_id),
                        "final_content": result["final_content"],
                    },
                    room=f"simulation_{chat_id}",
                )

                # Emit stop signal
                await sio.emit(
                    "simulation_stopped",
                    {
                        "chat_id": chat_id,
                        "success": True,
                        "message": "",  # Empty message, no toast
                    },
                    room=f"simulation_{chat_id}",
                )

            else:
                logger.warning(f"No active simulation run found for chat {chat_id}")
                await sio.emit(
                    "simulation_stopped",
                    {
                        "chat_id": chat_id,
                        "success": False,
                        "message": "No active message found for this chat",
                    },
                    room=f"simulation_{chat_id}",
                )

    except Exception as e:
        logger.error(f"Error stopping simulation for {sid}: {str(e)}")
        await sio.emit(
            "simulation_error",
            {"success": False, "message": f"Failed to stop simulation: {str(e)}"},
            room=sid,
        )
        logger.error(f"Emitted error to {sid}: Failed to stop simulation: {str(e)}")
