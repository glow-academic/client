"""Handler for simulation_voice_user_text WebSocket event."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.main import get_pool, sio
from app.socket.v3.simulations.streaming.message import (
    _simulation_message_start_impl,
)

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class VoiceUserMessagePayload(BaseModel):
    """Request to send user text message in voice simulation."""

    chat_id: str
    message: str
    transcription_id: str | None = None


class VoiceUserMessageErrorPayload(BaseModel):
    """Response indicating an error occurred while sending user message."""

    success: bool
    message: str


# Emit helper functions
async def simulation_voice_user_text_error(
    payload: VoiceUserMessageErrorPayload, room: str
) -> None:
    await sio.emit("simulations_voice_user_text_error", payload.model_dump(), room=room)


async def _simulation_voice_user_text_impl(
    sid: str, data: VoiceUserMessagePayload
) -> None:
    """Handle user message from Realtime API.

    When a user sends a message via the Realtime API (typed or spoken),
    create the user message in the database and emit events for UI consistency.
    """
    try:
        logger.info(
            f"Received simulation_voice_user_text from {sid}: chat_id={data.chat_id}, message_length={len(data.message)}"
        )

        chat_id = data.chat_id
        if not chat_id:
            await simulation_voice_user_text_error(
                VoiceUserMessageErrorPayload(success=False, message="Missing chat_id"),
                room=sid,
            )
            return

        message_str = data.message
        if not message_str or not message_str.strip():
            await simulation_voice_user_text_error(
                VoiceUserMessageErrorPayload(
                    success=False, message="Missing or empty message"
                ),
                room=sid,
            )
            return

        chat_id_uuid = uuid.UUID(chat_id)
        pool = get_pool()
        if not pool:
            logger.error("Database connection pool not available")
            await simulation_voice_user_text_error(
                VoiceUserMessageErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Get latest run for the chat (now uses groups/group_runs)
            sql_get_latest_run = load_sql(
                "app/sql/v3/simulations/get_latest_run_for_chat.sql"
            )
            latest_run_row = await conn.fetchrow(
                sql_get_latest_run,
                str(chat_id_uuid),
            )

            if not latest_run_row:
                logger.error(f"No run found for chat {chat_id}")
                await simulation_voice_user_text_error(
                    VoiceUserMessageErrorPayload(
                        success=False,
                        message=f"No run found for chat {chat_id}. Start a simulation first.",
                    ),
                    room=sid,
                )
                return

            run_id_for_message = latest_run_row["run_id"]

            # Create user message via unified handler
            db_message_id_str = await _simulation_message_start_impl(
                sid,
                {
                    "chat_id": str(chat_id_uuid),
                    "run_id": str(run_id_for_message),
                    "role": "user",
                    "content": message_str,
                    "completed": True,
                },
                conn=conn,
            )
            if not db_message_id_str:
                logger.error("Failed to create user message via unified handler")
                return

            user_message_id = uuid.UUID(db_message_id_str)

            # Get created_at for emission
            sql_get_created_at = load_sql(
                "app/sql/v3/messages/get_message_created_at.sql"
            )
            message_row = await conn.fetchrow(sql_get_created_at, user_message_id)
            created_at = message_row["created_at"] if message_row else None

            # Note: simulation_new_message is already emitted by _simulation_message_start_impl
            # Emit message_sent event for tour progression and cross-component communication
            from app.socket.v3.agents.simulation_text.send import (
                MessageSentPayload,
                message_sent,
            )

            await message_sent(
                MessageSentPayload(
                    message_id=str(user_message_id),
                    chat_id=str(chat_id_uuid),
                    message=message_str,
                    created_at=created_at.isoformat() if created_at else "",
                ),
                room=f"simulation_{chat_id_uuid}",
            )

            logger.info(
                f"Created user message {user_message_id} for chat {chat_id} via voice mode"
            )

    except ValueError as e:
        logger.error(
            f"Invalid UUID format in simulation_voice_user_text for {sid}: {e}"
        )
        await simulation_voice_user_text_error(
            VoiceUserMessageErrorPayload(
                success=False, message=f"Invalid chat_id format: {str(e)}"
            ),
            room=sid,
        )
    except Exception as e:
        logger.error(
            f"Error in simulation_voice_user_text for {sid}: {str(e)}", exc_info=True
        )
        await simulation_voice_user_text_error(
            VoiceUserMessageErrorPayload(success=False, message=str(e)), room=sid
        )


@sio.event  # type: ignore
async def simulation_voice_user_text(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = VoiceUserMessagePayload(**data)
        await _simulation_voice_user_text_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_voice_user_text for {sid}: {e}")
        await simulation_voice_user_text_error(
            VoiceUserMessageErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/text", response_model=dict[str, bool])
async def simulation_voice_user_text_api(
    request: VoiceUserMessagePayload,
) -> dict[str, bool]:
    """Client-to-server event: Send a text message in voice simulation."""
    return {"success": True}


@server_router.post("/text_error", response_model=dict[str, bool])
async def simulation_voice_user_text_error_api(
    request: VoiceUserMessageErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while processing user text in voice simulation."""
    return {"success": True}
