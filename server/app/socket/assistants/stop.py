"""Handler for stop_assistant WebSocket event."""

import logging
from typing import Any

from pydantic import BaseModel, ValidationError

from app.main import get_pool, sio
from app.utils.sql_helper import load_sql
from app.utils.websocket.cancel_active_run import cancel_active_run

logger = logging.getLogger(__name__)


# Pydantic models for server-to-client events
class StopAssistantErrorPayload(BaseModel):
    success: bool
    message: str
    chat_id: str | None = None
    error: str | None = None


class AssistantStoppedPayload(BaseModel):
    chat_id: str
    success: bool
    message: str


# Pydantic model for client-to-server event
class StopAssistantPayload(BaseModel):
    chat_id: str


# Emit helper functions
async def stop_assistant_error(payload: StopAssistantErrorPayload, room: str) -> None:
    await sio.emit(
        "stop_assistant_error", payload.model_dump(exclude_none=True), room=room
    )


async def assistant_stopped(payload: AssistantStoppedPayload, room: str) -> None:
    await sio.emit("assistant_stopped", payload.model_dump(), room=room)


async def _stop_assistant_impl(sid: str, data: StopAssistantPayload) -> None:
    """
    Handle assistant stop requests via WebSocket
    Replaces /assistants/stop endpoint
    """
    try:
        chat_id = data.chat_id

        if not chat_id:
            await stop_assistant_error(
                StopAssistantErrorPayload(success=False, message="Missing chat_id"),
                room=sid,
            )
            logger.error(f"Emitted assistant error to {sid}: Missing chat_id")
            return

        # Get connection from pool
        pool = get_pool()
        if not pool:
            await stop_assistant_error(
                StopAssistantErrorPayload(
                    success=False, message="Database not available"
                ),
                room=sid,
            )
            logger.error(f"Emitted assistant error to {sid}: Database not available")
            return

        async with pool.acquire() as conn:
            # Verify the chat exists
            sql = load_sql("sql/v3/assistant/verify_chat_exists.sql")
            chat_row = await conn.fetchrow(sql, chat_id)
            if not chat_row:
                await stop_assistant_error(
                    StopAssistantErrorPayload(success=False, message="Chat not found"),
                    room=sid,
                )
                logger.error(f"Emitted assistant error to {sid}: Chat not found")
                return

            # Attempt to cancel the assistant run - inlined cancel_assistant_run
            success = await cancel_active_run(chat_id)

            if success:
                logger.info(f"Successfully cancelled assistant run for chat {chat_id}")

                # Emit stop signal via WebSocket
                await assistant_stopped(
                    AssistantStoppedPayload(
                        chat_id=chat_id,
                        success=True,
                        message="Assistant stopped successfully",
                    ),
                    room=f"assistant_{chat_id}",
                )

            else:
                logger.warning(f"No active assistant run found for chat {chat_id}")
                await assistant_stopped(
                    AssistantStoppedPayload(
                        chat_id=chat_id,
                        success=False,
                        message="No active assistant run found",
                    ),
                    room=f"assistant_{chat_id}",
                )

    except Exception as e:
        logger.error(f"Error stopping assistant for {sid}: {str(e)}")
        await stop_assistant_error(
            StopAssistantErrorPayload(
                success=False, message=f"Failed to stop assistant: {str(e)}"
            ),
            room=sid,
        )
        logger.error(
            f"Emitted assistant error to {sid}: Failed to stop assistant: {str(e)}"
        )


@sio.event  # type: ignore
async def stop_assistant(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = StopAssistantPayload(**data)
        await _stop_assistant_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in stop_assistant for {sid}: {e}")
        await stop_assistant_error(
            StopAssistantErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
