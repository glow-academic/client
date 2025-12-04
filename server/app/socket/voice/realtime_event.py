"""Handler for voice_realtime_event WebSocket event - forwards OpenAI Realtime events."""

import json
import uuid
from typing import Any

from app.main import _voice_sessions, get_pool, sio
from app.utils.logging.db_logger import get_logger
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)


# Pydantic models
class VoiceRealtimeEventPayload(BaseModel):
    """Client-to-server payload for voice_realtime_event."""

    chat_id: str
    event_type: str  # e.g., "input_audio_buffer.append", "response.audio_transcript.delta", etc.
    event_data: dict[str, Any]  # Event-specific data


class VoiceRealtimeEventErrorPayload(BaseModel):
    """Server-to-client error payload."""

    success: bool
    message: str


# Emit helper functions
async def voice_realtime_event_error(
    payload: VoiceRealtimeEventErrorPayload, room: str
) -> None:
    await sio.emit("voice_realtime_event_error", payload.model_dump(), room=room)


async def _voice_realtime_event_impl(
    sid: str, data: VoiceRealtimeEventPayload
) -> None:
    """Handle forwarded OpenAI Realtime events from frontend.

    This handler receives events from the frontend's thin Realtime wrapper
    and processes them. For tool calls, it executes persona tools and streams
    responses via existing WebSocket events.
    """
    try:
        logger.debug(
            f"Received voice_realtime_event from {sid}: type={data.event_type}, chat_id={data.chat_id}"
        )

        chat_id = data.chat_id
        if not chat_id:
            await voice_realtime_event_error(
                VoiceRealtimeEventErrorPayload(
                    success=False, message="Missing chat_id"
                ),
                room=sid,
            )
            return

        # Get voice session
        session_data = _voice_sessions.get(chat_id)
        if not session_data:
            await voice_realtime_event_error(
                VoiceRealtimeEventErrorPayload(
                    success=False,
                    message=f"No active voice session for chat {chat_id}",
                ),
                room=sid,
            )
            return

        # Handle different event types
        event_type = data.event_type
        event_data = data.event_data  # Should already be dict[str, Any] from Pydantic

        # For now, we'll handle tool calls when they come through
        # The OpenAI Realtime API will send tool calls as events
        # We need to detect these and execute the persona tools

        if event_type == "response.function_call_arguments.done":
            # Tool call detected - the tool call message IS the persona's response
            logger.info(f"Tool call detected in chat {chat_id}: {event_data}")

            # Extract tool name and arguments
            tool_name = event_data.get("name", "")
            tool_arguments = event_data.get("arguments", {})

            # Check if it's a persona tool
            if tool_name.startswith("speak_"):
                # The tool call contains the message - stream it directly
                message_content = tool_arguments.get("message", "")
                if not message_content:
                    logger.warning(
                        f"Persona tool {tool_name} called but no message in arguments"
                    )
                    return

                logger.info(
                    f"Persona tool called: {tool_name}, streaming message: {message_content[:100]}..."
                )

                # Stream the message via existing WebSocket events
                # This matches the pattern used in send_message.py
                chat_id_uuid = uuid.UUID(chat_id)
                pool = get_pool()
                if not pool:
                    logger.error("Database connection pool not available")
                    return

                async with pool.acquire() as conn:
                    # Get latest run for this chat
                    from app.utils.sql_helper import load_sql

                    sql_get_run = load_sql(
                        "sql/v3/simulations/get_latest_run_for_chat.sql"
                    )
                    run_row = await conn.fetchrow(sql_get_run, chat_id_uuid)

                    if not run_row:
                        logger.error(f"No run found for chat {chat_id}")
                        return

                    run_id = run_row["run_id"]

                    # Create assistant message
                    sql_create_message = load_sql(
                        "sql/v3/simulations/create_message.sql"
                    )
                    assistant_message_row = await conn.fetchrow(
                        sql_create_message, "assistant", "", False
                    )
                    assistant_message = {
                        "id": assistant_message_row["id"],
                        "created_at": assistant_message_row["created_at"],
                    }

                    # Link message to run
                    sql_link = load_sql(
                        "sql/v3/simulations/link_message_to_run.sql"
                    )
                    await conn.execute(
                        sql_link, str(assistant_message["id"]), run_id
                    )

                    # Emit new message event
                    from app.socket.simulations.send_message import (
                        SimulationNewMessagePayload, simulation_new_message)

                    await simulation_new_message(
                        SimulationNewMessagePayload(
                            message_id=str(assistant_message["id"]),
                            chat_id=chat_id,
                            role="assistant",
                            content="",
                            completed=False,
                            created_at=assistant_message["created_at"].isoformat(),
                        ),
                        room=f"simulation_{chat_id_uuid}",
                    )

                    # Stream message content token by token (simulate streaming)
                    from app.socket.simulations.send_message import (
                        SimulationMessageTokenPayload,
                        simulation_message_token)

                    accumulated_content = ""
                    # Split message into tokens (words) for streaming
                    words = message_content.split()
                    for word in words:
                        token = word + " "
                        accumulated_content += token

                        await simulation_message_token(
                            SimulationMessageTokenPayload(
                                message_id=str(assistant_message["id"]),
                                chat_id=chat_id,
                                token=token,
                                accumulated_content=accumulated_content,
                            ),
                            room=f"simulation_{chat_id_uuid}",
                        )

                    # Update message in database
                    sql_update = load_sql(
                        "sql/v3/simulations/update_message_content.sql"
                    )
                    await conn.execute(
                        sql_update, accumulated_content.strip(), str(assistant_message["id"])
                    )

                    # Complete message
                    sql_complete = load_sql(
                        "sql/v3/simulations/complete_message.sql"
                    )
                    await conn.execute(
                        sql_complete,
                        accumulated_content.strip(),
                        str(assistant_message["id"]),
                    )

                    # Emit completion event
                    from app.socket.simulations.send_message import (
                        SimulationMessageCompletePayload,
                        simulation_message_complete)

                    await simulation_message_complete(
                        SimulationMessageCompletePayload(
                            message_id=str(assistant_message["id"]),
                            chat_id=chat_id,
                            final_content=accumulated_content.strip(),
                        ),
                        room=f"simulation_{chat_id_uuid}",
                    )

                    logger.info(
                        f"Streamed persona message from {tool_name} for chat {chat_id}"
                    )

        # Forward other events (we'll implement full OpenAI Realtime integration later)
        # For now, this is a placeholder that acknowledges receipt
        logger.debug(f"Processed realtime event: {event_type}")

    except Exception as e:
        logger.error(
            f"Error in voice_realtime_event for {sid}: {str(e)}", exc_info=True
        )
        await voice_realtime_event_error(
            VoiceRealtimeEventErrorPayload(success=False, message=str(e)), room=sid
        )


@sio.event  # type: ignore
async def voice_realtime_event(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = VoiceRealtimeEventPayload(**data)
        await _voice_realtime_event_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in voice_realtime_event for {sid}: {e}")
        await voice_realtime_event_error(
            VoiceRealtimeEventErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )

