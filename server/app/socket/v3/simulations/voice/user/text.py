"""Handler for simulation_voice_user_text WebSocket event."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import get_pool, sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

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
            # Get latest run for the chat (same pattern as send_message.py)
            latest_run_row = await conn.fetchrow(
                """
                SELECT rc.run_id::text as run_id
                FROM chat_runs rc
                JOIN runs r ON r.id = rc.run_id
                WHERE rc.chat_id = $1::uuid
                ORDER BY r.created_at DESC
                LIMIT 1
                """,
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

            # Create user message
            sql_create_message = load_sql("sql/v3/simulations/create_message.sql")
            user_message_row = await conn.fetchrow(
                sql_create_message, "user", message_str, True, None
            )
            user_message = {
                "id": user_message_row["id"],
                "created_at": user_message_row["created_at"],
            }

            # Link message to run via message_runs
            sql_link = load_sql("sql/v3/simulations/link_message_to_run.sql")
            await conn.execute(
                sql_link,
                str(user_message["id"]),
                run_id_for_message,
            )

            # Create branch from latest message to new user message (if latest exists)
            # Get latest message in chat to use as parent for message_tree
            # (messages with no active children are the latest/leaf nodes)
            # Exclude the newly created message to prevent self-reference
            latest_message_row = await conn.fetchrow(
                """
                SELECT m.id
                FROM messages m
                JOIN message_runs mr ON mr.message_id = m.id
                JOIN chat_runs cr ON cr.run_id = mr.run_id
                WHERE cr.chat_id = $1::uuid
                  AND m.id != $2::uuid
                  AND NOT EXISTS (
                      SELECT 1 FROM message_tree mt 
                      WHERE mt.parent_id = m.id AND mt.active = true
                  )
                ORDER BY m.created_at DESC
                LIMIT 1
                """,
                chat_id_uuid,
                user_message["id"],
            )
            if latest_message_row and latest_message_row["id"] != user_message["id"]:
                sql_branch = load_sql("sql/v3/simulations/create_message_branch.sql")
                await conn.execute(
                    sql_branch,
                    str(latest_message_row["id"]),
                    str(user_message["id"]),
                )
                logger.info(
                    f"Created branch from message {latest_message_row['id']} to user message {user_message['id']}"
                )

            # Emit user message to connected clients (same pattern as send_message.py)
            from app.socket.v3.simulations.text.send import (
                MessageSentPayload,
                SimulationNewMessagePayload,
                message_sent,
                simulation_new_message,
            )

            logger.info(f"Emitting user message to room simulation_{chat_id_uuid}")
            await simulation_new_message(
                SimulationNewMessagePayload(
                    message_id=str(user_message["id"]),
                    chat_id=str(chat_id_uuid),
                    role="user",
                    content=message_str,
                    completed=True,
                    created_at=user_message["created_at"].isoformat(),
                ),
                room=f"simulation_{chat_id_uuid}",
            )

            # Emit message_sent event for tour progression and cross-component communication
            await message_sent(
                MessageSentPayload(
                    message_id=str(user_message["id"]),
                    chat_id=str(chat_id_uuid),
                    message=message_str,
                    created_at=user_message["created_at"].isoformat(),
                ),
                room=f"simulation_{chat_id_uuid}",
            )

            logger.info(
                f"Created user message {user_message['id']} for chat {chat_id} via voice mode"
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
