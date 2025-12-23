"""Handler for simulation_voice_assistant_audio_link WebSocket event."""

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
class VoiceAssistantAudioLinkPayload(BaseModel):
    """Request to link audio upload to assistant message."""

    chat_id: str
    message_id: str
    upload_id: str


class VoiceAssistantAudioLinkErrorPayload(BaseModel):
    """Response indicating an error occurred linking audio."""

    success: bool
    message: str


# Emit helper functions
async def voice_assistant_audio_link_error(
    payload: VoiceAssistantAudioLinkErrorPayload, room: str
) -> None:
    await sio.emit(
        "simulations_voice_assistant_audio_link_error",
        payload.model_dump(),
        room=room,
    )


async def _simulation_voice_assistant_audio_link_impl(
    sid: str, data: VoiceAssistantAudioLinkPayload
) -> None:
    """Handle linking audio upload to assistant message.

    Validates that the message belongs to the chat and the upload exists,
    then creates the link in the message_audio junction table.
    """
    try:
        chat_id = data.chat_id
        message_id = data.message_id
        upload_id = data.upload_id

        if not chat_id:
            await voice_assistant_audio_link_error(
                VoiceAssistantAudioLinkErrorPayload(
                    success=False, message="Missing chat_id"
                ),
                room=sid,
            )
            return

        if not message_id:
            await voice_assistant_audio_link_error(
                VoiceAssistantAudioLinkErrorPayload(
                    success=False, message="Missing message_id"
                ),
                room=sid,
            )
            return

        if not upload_id:
            await voice_assistant_audio_link_error(
                VoiceAssistantAudioLinkErrorPayload(
                    success=False, message="Missing upload_id"
                ),
                room=sid,
            )
            return

        chat_id_uuid = uuid.UUID(chat_id)
        message_id_uuid = uuid.UUID(message_id)
        upload_id_uuid = uuid.UUID(upload_id)

        pool = get_pool()
        if not pool:
            logger.error("Database connection pool not available")
            await voice_assistant_audio_link_error(
                VoiceAssistantAudioLinkErrorPayload(
                    success=False,
                    message="Database connection pool not available",
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Validate message belongs to chat
            sql_validate_message = load_sql(
                "sql/v3/simulations/validate_message_belongs_to_chat.sql"
            )
            message_row = await conn.fetchrow(
                sql_validate_message, str(chat_id_uuid), str(message_id_uuid)
            )

            if not message_row:
                logger.warning(
                    f"Message {message_id} does not belong to chat {chat_id}"
                )
                await voice_assistant_audio_link_error(
                    VoiceAssistantAudioLinkErrorPayload(
                        success=False,
                        message=f"Message {message_id} does not belong to chat {chat_id}",
                    ),
                    room=sid,
                )
                return

            # Validate upload exists
            sql_get_upload = load_sql("sql/v3/uploads/get_upload_id.sql")
            upload_row = await conn.fetchrow(sql_get_upload, str(upload_id_uuid))

            if not upload_row:
                logger.warning(f"Upload {upload_id} does not exist")
                await voice_assistant_audio_link_error(
                    VoiceAssistantAudioLinkErrorPayload(
                        success=False, message=f"Upload {upload_id} does not exist"
                    ),
                    room=sid,
                )
                return

            # Link audio upload to message
            try:
                sql_insert_message_audio = load_sql(
                    "sql/v3/simulations/insert_message_audio.sql"
                )
                await conn.execute(
                    sql_insert_message_audio,
                    str(message_id_uuid),
                    str(upload_id_uuid),
                )
                logger.info(
                    f"Linked audio upload {upload_id} to assistant message {message_id}"
                )
            except Exception as e:
                # Check if it's a duplicate key error (already linked)
                if (
                    "duplicate key" in str(e).lower()
                    or "unique constraint" in str(e).lower()
                ):
                    logger.info(
                        f"Audio upload {upload_id} already linked to message {message_id}"
                    )
                else:
                    logger.error(
                        f"Error linking audio upload to message: {e}", exc_info=True
                    )
                    await voice_assistant_audio_link_error(
                        VoiceAssistantAudioLinkErrorPayload(
                            success=False,
                            message=f"Failed to link audio: {str(e)}",
                        ),
                        room=sid,
                    )
                    return

    except ValueError as e:
        logger.error(
            f"Invalid UUID format in simulation_voice_assistant_audio_link for {sid}: {e}"
        )
        await voice_assistant_audio_link_error(
            VoiceAssistantAudioLinkErrorPayload(
                success=False, message=f"Invalid UUID format: {str(e)}"
            ),
            room=sid,
        )
    except Exception as e:
        logger.error(
            f"Error handling simulation_voice_assistant_audio_link: {e}",
            exc_info=True,
        )
        await voice_assistant_audio_link_error(
            VoiceAssistantAudioLinkErrorPayload(success=False, message=str(e)),
            room=sid,
        )


@sio.event  # type: ignore
async def simulation_voice_assistant_audio_link(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = VoiceAssistantAudioLinkPayload(**data)
        await _simulation_voice_assistant_audio_link_impl(sid, validated)
    except ValidationError as e:
        logger.error(
            f"Validation error in simulation_voice_assistant_audio_link for {sid}: {e}"
        )
        await voice_assistant_audio_link_error(
            VoiceAssistantAudioLinkErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/audio_link", response_model=dict[str, bool])
async def simulation_voice_assistant_audio_link_api(
    request: VoiceAssistantAudioLinkPayload,
) -> dict[str, bool]:
    """Client-to-server event: Link audio upload to assistant message."""
    return {"success": True}


@server_router.post("/audio_link", response_model=dict[str, bool])
async def simulation_voice_assistant_audio_link_server_api(
    request: VoiceAssistantAudioLinkPayload,
) -> dict[str, bool]:
    """Server-to-client event: Audio upload linked to assistant message."""
    return {"success": True}
