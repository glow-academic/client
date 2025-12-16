"""Handler for simulation_voice_user_transcript WebSocket event."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.main import get_pool, get_voice_speech_timestamps, sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class VoiceUserTranscriptPayload(BaseModel):
    """Client-to-server payload for simulation_voice_user_transcript."""

    chat_id: str
    item_id: str
    transcript: str
    upload_id: str | None = None


# Emit helper functions
async def simulation_voice_user_transcript_emit(
    payload: VoiceUserTranscriptPayload, room: str
) -> None:
    """Emit simulation_voice_user_transcript event to room (server-to-client)."""
    await sio.emit("simulations_voice_user_transcript", payload.model_dump(), room=room)


async def _simulation_voice_user_transcript_impl(
    sid: str, data: VoiceUserTranscriptPayload
) -> None:
    """Handle transcript ready event from Realtime API.

    This event is emitted when the user's speech is transcribed. We:
    1. Relay it back to the room so AttemptMessages can update the optimistic message
    2. Create the actual user message in the database
    """
    try:
        logger.info(
            f"Received simulation_voice_user_transcript from {sid}: chat_id={data.chat_id}, "
            f"transcript_length={len(data.transcript)}, item_id={data.item_id}"
        )

        chat_id = data.chat_id
        if not chat_id:
            logger.warning(
                f"Missing chat_id in simulation_voice_user_transcript from {sid}"
            )
            return

        transcript = data.transcript
        if not transcript or not transcript.strip():
            logger.warning(
                f"Empty transcript in simulation_voice_user_transcript from {sid}"
            )
            return

        room = f"simulation_{chat_id}"

        # First, relay the event for UI updates (so optimistic message shows transcript immediately)
        await simulation_voice_user_transcript_emit(data, room)

        # Then create the actual user message in the database
        chat_id_uuid = uuid.UUID(chat_id)
        pool = get_pool()
        if not pool:
            logger.error("Database connection pool not available")
            return

        async with pool.acquire() as conn:
            # Get latest run for the chat (same pattern as voice_user_message.py)
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
                return

            run_id_for_message = latest_run_row["run_id"]

            # Get stored timestamp for this speech event (if available)
            timestamps_dict = get_voice_speech_timestamps()
            speech_started_at = None
            if chat_id in timestamps_dict and data.item_id in timestamps_dict[chat_id]:
                speech_started_at = timestamps_dict[chat_id][data.item_id]
                # Clean up the timestamp entry after use
                del timestamps_dict[chat_id][data.item_id]
                # Clean up empty chat_id entry if no more timestamps
                if not timestamps_dict[chat_id]:
                    del timestamps_dict[chat_id]
                logger.info(
                    f"Using stored speech_started timestamp for item_id={data.item_id}: {speech_started_at}"
                )
            else:
                logger.warning(
                    f"No stored timestamp found for item_id={data.item_id}, using NOW()"
                )

            # Create user message with stored timestamp (or NOW() if not found)
            sql_create_message = load_sql("sql/v3/simulations/create_message.sql")
            user_message_row = await conn.fetchrow(
                sql_create_message, "user", transcript, True, speech_started_at
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
            else:
                logger.info(
                    f"Created user message {user_message['id']} (no previous message to branch from)"
                )

            # Link audio upload to message if upload_id is provided
            if data.upload_id:
                try:
                    upload_id_uuid = uuid.UUID(data.upload_id)
                    sql_insert_message_audio = load_sql(
                        "sql/v3/simulations/insert_message_audio.sql"
                    )
                    await conn.execute(
                        sql_insert_message_audio,
                        str(user_message["id"]),
                        str(upload_id_uuid),
                    )
                    logger.info(
                        f"Linked audio upload {data.upload_id} to message {user_message['id']}"
                    )
                except ValueError as e:
                    logger.warning(
                        f"Invalid upload_id format {data.upload_id} in simulation_voice_user_transcript: {e}"
                    )
                except Exception as e:
                    logger.error(
                        f"Error linking audio upload to message: {e}", exc_info=True
                    )

            # Emit user message to connected clients (same pattern as voice_user_message.py)
            from app.socket.v3.simulations.text.send import (
                MessageSentPayload, SimulationNewMessagePayload, message_sent,
                simulation_new_message)

            logger.info(f"Emitting user message to room simulation_{chat_id_uuid}")
            await simulation_new_message(
                SimulationNewMessagePayload(
                    message_id=str(user_message["id"]),
                    chat_id=str(chat_id_uuid),
                    role="user",
                    content=transcript,
                    completed=True,
                    created_at=user_message["created_at"].isoformat(),
                ),
                room=room,
            )

            # Emit message_sent event for tour progression and cross-component communication
            await message_sent(
                MessageSentPayload(
                    message_id=str(user_message["id"]),
                    chat_id=str(chat_id_uuid),
                    message=transcript,
                    created_at=user_message["created_at"].isoformat(),
                ),
                room=room,
            )

            logger.info(
                f"Created user message {user_message['id']} for chat {chat_id} via simulation_voice_user_transcript"
            )

    except ValueError as e:
        logger.error(
            f"Invalid UUID format in simulation_voice_user_transcript for {sid}: {e}"
        )
    except Exception as e:
        logger.error(
            f"Error handling simulation_voice_user_transcript: {e}", exc_info=True
        )


@sio.event  # type: ignore
async def simulation_voice_user_transcript(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = VoiceUserTranscriptPayload(**data)
        await _simulation_voice_user_transcript_impl(sid, validated)
    except ValidationError as e:
        logger.error(
            f"Validation error in simulation_voice_user_transcript for {sid}: {e}"
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/transcript", response_model=dict[str, bool])
async def simulation_voice_user_transcript_api(request: VoiceUserTranscriptPayload) -> dict[str, bool]:
    """Client-to-server event: Send user transcript from voice simulation."""
    return {"success": True}


@server_router.post("/transcript", response_model=dict[str, bool])
async def simulation_voice_user_transcript_api(request: VoiceUserTranscriptPayload) -> dict[str, bool]:
    """Server-to-client event: User transcript from voice simulation."""
    return {"success": True}
