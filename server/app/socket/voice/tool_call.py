"""Handler for voice_tool_call WebSocket event."""

import uuid
from typing import Any

from app.main import _voice_sessions, get_pool, sio
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)


# Pydantic models
class VoiceToolCallPayload(BaseModel):
    """Client-to-server payload for voice_tool_call."""

    chat_id: str
    tool_name: str
    arguments: dict[str, Any]


class VoiceToolCallErrorPayload(BaseModel):
    """Server-to-client error payload."""

    success: bool
    message: str


# Emit helper functions
async def voice_tool_call_error(
    payload: VoiceToolCallErrorPayload, room: str
) -> None:
    await sio.emit("voice_tool_call_error", payload.model_dump(), room=room)


async def _voice_tool_call_impl(sid: str, data: VoiceToolCallPayload) -> None:
    """Handle tool call from Realtime API.

    When a persona tool is called, stream the message via existing WebSocket events.
    """
    try:
        logger.info(
            f"Received voice_tool_call from {sid}: tool={data.tool_name}, chat_id={data.chat_id}"
        )

        chat_id = data.chat_id
        if not chat_id:
            await voice_tool_call_error(
                VoiceToolCallErrorPayload(
                    success=False, message="Missing chat_id"
                ),
                room=sid,
            )
            return

        # Get voice session
        session_data = _voice_sessions.get(chat_id)
        if not session_data:
            await voice_tool_call_error(
                VoiceToolCallErrorPayload(
                    success=False,
                    message=f"No active voice session for chat {chat_id}",
                ),
                room=sid,
            )
            return

        tool_name = data.tool_name
        tool_arguments = data.arguments

        # Check if it's a persona tool
        if not tool_name.startswith("speak_"):
            logger.warning(
                f"Received non-persona tool call: {tool_name} for chat {chat_id}"
            )
            return

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
            await voice_tool_call_error(
                VoiceToolCallErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Get context from voice session
            context_row = session_data.get("context_row")
            if not context_row:
                logger.error(f"No context found in voice session for chat {chat_id}")
                await voice_tool_call_error(
                    VoiceToolCallErrorPayload(
                        success=False,
                        message=f"No context found in voice session for chat {chat_id}",
                    ),
                    room=sid,
                )
                return

            # Extract persona name from tool_name (e.g., "speak_passive" -> "passive")
            persona_name = tool_name.replace("speak_", "").replace("_", " ")
            
            # Find the persona_id from the personas list stored in session
            # The personas list has keys: persona_id, persona_name (from SQL query)
            personas = session_data.get("personas", [])
            persona_id = None
            for persona in personas:
                # Check both possible key names (persona_name from SQL, name from dict conversion)
                persona_name_from_db = persona.get("persona_name") or persona.get("name", "")
                if persona_name_from_db.lower() == persona_name.lower():
                    persona_id = persona.get("persona_id") or persona.get("id")
                    break
            
            if not persona_id:
                logger.error(
                    f"Persona '{persona_name}' not found in voice session for chat {chat_id}. "
                    f"Available personas: {[p.get('persona_name') or p.get('name', '') for p in personas]}"
                )
                await voice_tool_call_error(
                    VoiceToolCallErrorPayload(
                        success=False,
                        message=f"Persona '{persona_name}' not found in voice session",
                    ),
                    room=sid,
                )
                return

            # Get key_id from model_keys table (first active key for this model)
            key_id_row = await conn.fetchrow(
                """
                SELECT mk.key_id::text as key_id
                FROM model_keys mk
                WHERE mk.model_id = $1::uuid AND mk.active = true
                LIMIT 1
                """,
                context_row.get("model_id"),
            )
            key_id = key_id_row["key_id"] if key_id_row else None

            # Get or create run for this chat
            # asyncpg has trouble inferring types when None is passed early in the parameter list
            # We need to ensure at least one UUID parameter before the first None is a string
            sql_get_or_create_run = load_sql(
                "sql/v3/simulations/get_or_create_run_for_chat.sql"
            )
            
            # Prepare parameters - ensure required UUIDs are present
            dept_id = context_row.get("department_id")
            model_id = context_row.get("model_id")
            profile_id_val = context_row.get("profile_id")
            
            # Validate required fields
            if not model_id:
                logger.error(f"model_id missing from context for chat {chat_id}")
                await voice_tool_call_error(
                    VoiceToolCallErrorPayload(
                        success=False,
                        message="Missing model_id in context",
                    ),
                    room=sid,
                )
                return
            
            if not persona_id:
                logger.error(f"persona_id missing for chat {chat_id}")
                await voice_tool_call_error(
                    VoiceToolCallErrorPayload(
                        success=False,
                        message="Missing persona_id",
                    ),
                    room=sid,
                )
                return
            
            # asyncpg has trouble inferring UUID types when None is passed early
            # Solution: use execute() with explicit type casting, or ensure dept_id is always a string
            # Since department_id should always exist from context (SQL has fallbacks),
            # let's ensure it's always a string UUID
            if not dept_id:
                logger.error(f"department_id missing from context for chat {chat_id}")
                await voice_tool_call_error(
                    VoiceToolCallErrorPayload(
                        success=False,
                        message="Missing department_id in context",
                    ),
                    room=sid,
                )
                return
            
            # Use execute() with explicit parameter types by passing all UUIDs as strings
            # asyncpg will infer UUID type from the SQL casts ($2::uuid, etc.)
            run_row = await conn.fetchrow(
                sql_get_or_create_run,
                str(chat_id_uuid),  # $1: chat_id
                str(dept_id),  # $2: department_id (always present as string)
                str(model_id),  # $3: model_id (always present as string)
                str(persona_id),  # $4: entity_id (always present as string)
                "persona",  # $5: entity_type
                str(profile_id_val) if profile_id_val else None,  # $6: profile_id
                str(key_id) if key_id else None,  # $7: key_id
                None,  # $8: agent_id
            )

            if not run_row:
                logger.error(f"Failed to get or create run for chat {chat_id}")
                await voice_tool_call_error(
                    VoiceToolCallErrorPayload(
                        success=False,
                        message=f"Failed to get or create run for chat {chat_id}",
                    ),
                    room=sid,
                )
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
                SimulationMessageTokenPayload, simulation_message_token)

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
                SimulationMessageCompletePayload, simulation_message_complete)

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

    except Exception as e:
        logger.error(
            f"Error in voice_tool_call for {sid}: {str(e)}", exc_info=True
        )
        await voice_tool_call_error(
            VoiceToolCallErrorPayload(success=False, message=str(e)), room=sid
        )


@sio.event  # type: ignore
async def voice_tool_call(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = VoiceToolCallPayload(**data)
        await _voice_tool_call_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in voice_tool_call for {sid}: {e}")
        await voice_tool_call_error(
            VoiceToolCallErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )

