"""Handler for simulation_voice_user_speech WebSocket event."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import _voice_message_ids, get_internal_sio, get_pool, sio
from app.socket.v3.simulations.text.send import (
    SimulationRunCompletePayload,
    simulation_run_complete,
)
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class CachedTokenDetails(BaseModel):
    """Cached token details within input token details."""

    audio_tokens: int | None = None
    text_tokens: int | None = None
    image_tokens: int | None = None


class InputTokenDetails(BaseModel):
    """Input token details from Realtime API usage."""

    audio_tokens: int | None = None
    text_tokens: int | None = None
    image_tokens: int | None = None
    cached_tokens: int | None = None
    cached_tokens_details: CachedTokenDetails | None = None


class OutputTokenDetails(BaseModel):
    """Output token details from Realtime API usage."""

    audio_tokens: int | None = None
    text_tokens: int | None = None


class VoiceUsage(BaseModel):
    """Token usage information from Realtime API."""

    input_token_details: InputTokenDetails
    output_token_details: OutputTokenDetails
    input_tokens: int
    output_tokens: int


class VoiceUserSpeechPayload(BaseModel):
    """Request to send user speech audio in voice simulation."""

    chat_id: str
    event_id: str
    response_id: str
    conversation_id: str
    usage: VoiceUsage


async def _simulation_voice_user_speech_impl(
    sid: str, data: VoiceUserSpeechPayload
) -> None:
    """Handle response.done event from Realtime API.

    Creates runs for accumulated message IDs and tracks token usage with separate
    audio/text/image token tracking.
    """
    try:
        logger.info(
            f"Received simulation_voice_user_speech from {sid} for chat {data.chat_id}, "
            f"response_id={data.response_id}, event_id={data.event_id}"
        )

        chat_id = data.chat_id
        if not chat_id:
            logger.warning(
                f"Missing chat_id in simulation_voice_user_speech from {sid}"
            )
            return

        chat_id_uuid = uuid.UUID(chat_id)
        pool = get_pool()
        if not pool:
            logger.error("Database connection pool not available")
            return

        # Get accumulated message IDs for this chat
        message_ids = _voice_message_ids.get(chat_id, [])

        # Process message IDs if any exist (for run creation)
        if message_ids:
            logger.info(
                f"Processing {len(message_ids)} message IDs for chat {chat_id}: {message_ids}"
            )

            async with pool.acquire() as conn:
                # Get chat context (department_id, model_id, agent_id, profile_id, key_id)
                sql_context = load_sql("app/sql/v3/agents/get_simulation_run_context.sql")
                context_row = await conn.fetchrow(sql_context, str(chat_id_uuid))

                if not context_row:
                    logger.error(f"Chat {chat_id} not found or no scenario configured")
                    # Clear accumulator even on error to prevent stale data
                    if chat_id in _voice_message_ids:
                        del _voice_message_ids[chat_id]
                    return

                # Extract required fields from context
                department_id_str = context_row.get("department_id")
                model_id_str = context_row.get("voice_model_id") or context_row.get(
                    "model_id"
                )
                voice_agent_id_str = context_row.get("voice_agent_id")
                profile_id_str = context_row.get("profile_id")

                if not department_id_str or not model_id_str:
                    logger.error(
                        f"Missing department_id or model_id in context for chat {chat_id}"
                    )
                    if chat_id in _voice_message_ids:
                        del _voice_message_ids[chat_id]
                    return

                # Convert to UUID objects
                try:
                    department_id_uuid = uuid.UUID(str(department_id_str))
                    model_id_uuid = uuid.UUID(str(model_id_str))
                    profile_id_uuid = (
                        uuid.UUID(str(profile_id_str)) if profile_id_str else None
                    )
                    voice_agent_id_uuid = (
                        uuid.UUID(str(voice_agent_id_str))
                        if voice_agent_id_str
                        else None
                    )
                except (ValueError, TypeError) as e:
                    logger.error(f"Invalid UUID format: {e}")
                    if chat_id in _voice_message_ids:
                        del _voice_message_ids[chat_id]
                    return

                if not voice_agent_id_uuid:
                    logger.error(
                        f"Missing voice_agent_id in context for chat {chat_id}"
                    )
                    if chat_id in _voice_message_ids:
                        del _voice_message_ids[chat_id]
                    return

                # Get key_id via settings system: provider -> active settings -> setting_provider_keys
                # Get active settings for profile (or default if no profile)
                if profile_id_uuid:
                    # Get active settings for profile
                    sql_get_key = load_sql("app/sql/v3/settings/get_key_id_for_model_with_profile.sql")
                    key_id_row = await conn.fetchrow(
                        sql_get_key,
                        model_id_uuid,
                        profile_id_uuid,
                    )
                else:
                    # Use default settings if no profile_id
                    sql_get_key = load_sql("app/sql/v3/settings/get_key_id_for_model_default.sql")
                    key_id_row = await conn.fetchrow(
                        sql_get_key,
                        model_id_uuid,
                    )
                key_id_uuid = None
                if key_id_row and key_id_row["key_id"]:
                    try:
                        key_id_uuid = uuid.UUID(key_id_row["key_id"])
                    except (ValueError, TypeError):
                        logger.warning(
                            f"Invalid key_id format from database: {key_id_row['key_id']}"
                        )

                # Get first persona ID for run creation (needed for entity_id)
                sql_personas = load_sql("app/sql/v3/voice/get_chat_personas.sql")
                persona_rows = await conn.fetch(sql_personas, str(chat_id_uuid))
                if not persona_rows or len(persona_rows) == 0:
                    logger.error(f"No personas found for chat {chat_id}")
                    if chat_id in _voice_message_ids:
                        del _voice_message_ids[chat_id]
                    return

                first_persona_id = None
                for persona_row in persona_rows:
                    persona_id_val = persona_row.get("persona_id") or persona_row.get(
                        "id"
                    )
                    if persona_id_val:
                        try:
                            first_persona_id = uuid.UUID(str(persona_id_val))
                            break
                        except (ValueError, TypeError):
                            continue

                if not first_persona_id:
                    logger.error(f"No valid persona ID found for chat {chat_id}")
                    if chat_id in _voice_message_ids:
                        del _voice_message_ids[chat_id]
                    return

                # Extract usage data
                usage = data.usage
                input_token_details = usage.input_token_details
                output_token_details = usage.output_token_details
                cached_token_details = (
                    input_token_details.cached_tokens_details
                    if input_token_details.cached_tokens_details
                    else None
                )

                input_text_tokens = (
                    (input_token_details.text_tokens or 0)
                    if input_token_details.text_tokens is not None
                    else 0
                )
                input_audio_tokens = (
                    (input_token_details.audio_tokens or 0)
                    if input_token_details.audio_tokens is not None
                    else 0
                )
                input_image_tokens = (
                    (input_token_details.image_tokens or 0)
                    if input_token_details.image_tokens is not None
                    else 0
                )
                output_text_tokens = (
                    (output_token_details.text_tokens or 0)
                    if output_token_details.text_tokens is not None
                    else 0
                )
                output_audio_tokens = (
                    (output_token_details.audio_tokens or 0)
                    if output_token_details.audio_tokens is not None
                    else 0
                )
                cached_text_tokens = (
                    (cached_token_details.text_tokens or 0)
                    if cached_token_details
                    and cached_token_details.text_tokens is not None
                    else 0
                )
                cached_audio_tokens = (
                    (cached_token_details.audio_tokens or 0)
                    if cached_token_details
                    and cached_token_details.audio_tokens is not None
                    else 0
                )

                # Create a run for each message ID
                sql_create_run = load_sql(
                    "sql/v3/model_runs/create_model_run_complete.sql"
                )
                sql_link_message = load_sql(
                    "sql/v3/simulations/link_message_to_run.sql"
                )

                runs_created = 0
                for message_id_str in message_ids:
                    try:
                        message_id_uuid = uuid.UUID(message_id_str)

                        # Create run
                        run_row = await conn.fetchrow(
                            sql_create_run,
                            str(department_id_uuid),
                            str(model_id_uuid),
                            str(first_persona_id),
                            "persona",
                            str(profile_id_uuid) if profile_id_uuid else None,
                            str(key_id_uuid) if key_id_uuid else None,
                            str(voice_agent_id_uuid),
                        )

                        if not run_row:
                            logger.error(
                                f"Failed to create run for message {message_id_str}"
                            )
                            continue

                        run_id = uuid.UUID(run_row["run_id"])

                        # Link run to chat's group (now uses groups/group_runs)
                        # Get or create group for chat, then link run to group
                        sql_get_group = load_sql("app/sql/v3/simulations/get_or_create_group_for_chat.sql")
                        chat_group_row = await conn.fetchrow(sql_get_group, str(chat_id_uuid))
                        if chat_group_row:
                            group_id = chat_group_row["group_id"]
                            sql_link_run = load_sql("app/sql/v3/simulations/link_run_to_group_complete.sql")
                            await conn.execute(sql_link_run, str(group_id), str(run_id))

                        # Link message to run (if message exists)
                        try:
                            await conn.execute(
                                sql_link_message,
                                str(message_id_uuid),
                                str(run_id),
                            )
                        except Exception as link_err:
                            logger.warning(
                                f"Failed to link message {message_id_str} to run {run_id}: {link_err}"
                            )
                            # Continue even if linking fails - message might not exist yet

                        # Emit async pricing event (non-blocking)
                        # This handles token updates and message logging in background via internal bus
                        await internal_sio.emit(
                            "log_run",
                            {
                                "runId": str(run_id),
                                "operationType": "voice",
                                "inputTextTokens": input_text_tokens,
                                "outputTextTokens": output_text_tokens,
                                "inputAudioTokens": input_audio_tokens,
                                "inputImageTokens": input_image_tokens,
                                "outputAudioTokens": output_audio_tokens,
                                "cachedTextTokens": cached_text_tokens
                                if cached_text_tokens > 0
                                else None,
                                "cachedAudioTokens": cached_audio_tokens
                                if cached_audio_tokens > 0
                                else None,
                                "systemPrompt": None,  # Voice doesn't use system prompts
                                "inputItems": None,  # Voice messages are handled separately
                                "assistantOutput": None,  # Voice responses are handled separately
                                "departmentId": str(department_id_uuid),
                            },
                        )

                        runs_created += 1
                        logger.info(
                            f"Created run {run_id} for message {message_id_str} with usage: "
                            f"input_text={input_text_tokens}, input_audio={input_audio_tokens}, "
                            f"input_image={input_image_tokens}, output_text={output_text_tokens}, "
                            f"output_audio={output_audio_tokens}"
                        )

                    except (ValueError, TypeError) as e:
                        logger.error(
                            f"Invalid message_id format {message_id_str}: {e}",
                            exc_info=True,
                        )
                        continue
                    except Exception as e:
                        logger.error(
                            f"Error creating run for message {message_id_str}: {e}",
                            exc_info=True,
                        )
                        continue

                logger.info(
                    f"Created {runs_created} runs for {len(message_ids)} messages in chat {chat_id}"
                )

                # Clear accumulated message IDs after processing
                if chat_id in _voice_message_ids:
                    del _voice_message_ids[chat_id]
        else:
            logger.info(
                f"No accumulated message IDs for chat {chat_id}, skipping run creation"
            )

        # Always emit simulation_run_complete to signal that the response is done
        # This will hide the stop button in the client, even if no message IDs were processed
        await simulation_run_complete(
            SimulationRunCompletePayload(chat_id=chat_id),
            room=f"simulation_{chat_id_uuid}",
        )

    except Exception as e:
        logger.error(
            f"Error in simulation_voice_user_speech for {sid}: {str(e)}", exc_info=True
        )
        # Clear accumulator on error to prevent stale data
        if chat_id in _voice_message_ids:
            del _voice_message_ids[chat_id]
        # Still emit simulation_run_complete even on error to hide stop button
        try:
            chat_uuid: uuid.UUID | None = uuid.UUID(chat_id) if chat_id else None
            if chat_uuid:
                await simulation_run_complete(
                    SimulationRunCompletePayload(chat_id=chat_id),
                    room=f"simulation_{chat_uuid}",
                )
        except Exception as emit_err:
            logger.error(
                f"Failed to emit simulation_run_complete after error: {emit_err}",
                exc_info=True,
            )


@sio.event  # type: ignore
async def simulation_voice_user_speech(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = VoiceUserSpeechPayload(**data)
        await _simulation_voice_user_speech_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_voice_user_speech for {sid}: {e}")


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/speech", response_model=dict[str, bool])
async def simulation_voice_user_speech_api(
    request: VoiceUserSpeechPayload,
) -> dict[str, bool]:
    """Client-to-server event: Send user speech audio in voice simulation."""
    return {"success": True}
