"""Handler for stop_assistant WebSocket event."""

import logging
import uuid
from typing import Any

import socketio  # type: ignore
from app.db import get_pool
from app.main import sio
from app.utils.sql_helper import load_sql
from app.socket.connections.utils import cancel_active_run

logger = logging.getLogger(__name__)


@sio.event  # type: ignore
async def stop_assistant(sid: str, data: dict[str, Any]) -> None:
    """
    Handle assistant stop requests via WebSocket
    Replaces /assistants/stop endpoint
    """
    try:
        chat_id = data.get("chat_id")

        if not chat_id:
            await sio.emit(
                "assistant_error", {"success": False, "message": "Missing chat_id"}, room=sid
            )
            logger.error(f"Emitted assistant error to {sid}: Missing chat_id")
            return

        # Get connection from pool
        pool = get_pool()
        if not pool:
            await sio.emit(
                "assistant_error", {"success": False, "message": "Database not available"}, room=sid
            )
            logger.error(f"Emitted assistant error to {sid}: Database not available")
            return

        async with pool.acquire() as conn:
            # Verify the chat exists
            sql = load_sql("sql/v3/assistant/verify_chat_exists.sql")
            chat_row = await conn.fetchrow(sql, chat_id)
            if not chat_row:
                await sio.emit(
                    "assistant_error", {"success": False, "message": "Chat not found"}, room=sid
                )
                logger.error(f"Emitted assistant error to {sid}: Chat not found")
                return

            # Attempt to cancel the assistant run - inlined cancel_assistant_run
            success = await cancel_active_run(chat_id)

            if success:
                logger.info(f"Successfully cancelled assistant run for chat {chat_id}")

                # Emit stop signal via WebSocket
                await sio.emit(
                    "assistant_stopped",
                    {
                        "chat_id": chat_id,
                        "success": True,
                        "message": "Assistant stopped successfully",
                    },
                    room=f"assistant_{chat_id}",
                )

            else:
                logger.warning(f"No active assistant run found for chat {chat_id}")
                await sio.emit(
                    "assistant_stopped",
                    {
                        "chat_id": chat_id,
                        "success": False,
                        "message": "No active assistant run found",
                    },
                    room=f"assistant_{chat_id}",
                )

    except Exception as e:
        logger.error(f"Error stopping assistant for {sid}: {str(e)}")
        await sio.emit(
            "assistant_error", {"success": False, "message": f"Failed to stop assistant: {str(e)}"}, room=sid
        )
        logger.error(f"Emitted assistant error to {sid}: Failed to stop assistant: {str(e)}")

