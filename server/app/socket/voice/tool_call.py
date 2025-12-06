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
    persona_id: str
    message: str
    profile_id: str | None


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
            f"Received voice_tool_call from {sid}: persona_id={data.persona_id}, chat_id={data.chat_id}"
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

        persona_id = data.persona_id
        message_content = data.message
        profile_id_val = data.profile_id

        if not persona_id:
            await voice_tool_call_error(
                VoiceToolCallErrorPayload(
                    success=False, message="Missing persona_id"
                ),
                room=sid,
            )
            return

        if not message_content:
            await voice_tool_call_error(
                VoiceToolCallErrorPayload(
                    success=False, message="Missing message"
                ),
                room=sid,
            )
            return

        logger.info(
            f"Persona tool called: persona_id={persona_id}, streaming message: {message_content[:100]}..."
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
            # Get context from chat_id (department_id, model_id, etc.)
            sql_context = load_sql("sql/v3/agents/get_simulation_run_context.sql")
            context_row = await conn.fetchrow(sql_context, str(chat_id_uuid))
            
            if not context_row:
                await voice_tool_call_error(
                    VoiceToolCallErrorPayload(
                        success=False,
                        message=f"Chat {chat_id} not found or no scenario configured",
                    ),
                    room=sid,
                )
                return

            # Extract required fields from context and validate they're valid UUIDs
            department_id_str = context_row.get("department_id")
            model_id_str = context_row.get("model_id")
            
            if not department_id_str:
                logger.error(f"department_id missing from context for chat {chat_id}")
                await voice_tool_call_error(
                    VoiceToolCallErrorPayload(
                        success=False,
                        message="Missing department_id in context",
                    ),
                    room=sid,
                )
                return
            
            if not model_id_str:
                logger.error(f"model_id missing from context for chat {chat_id}")
                await voice_tool_call_error(
                    VoiceToolCallErrorPayload(
                        success=False,
                        message="Missing model_id in context",
                    ),
                    room=sid,
                )
                return

            # Validate and convert to UUID objects to ensure they're valid
            try:
                department_id_uuid_obj = uuid.UUID(str(department_id_str))
                model_id_uuid_obj = uuid.UUID(str(model_id_str))
                persona_id_uuid_obj = uuid.UUID(str(persona_id))
            except (ValueError, TypeError) as e:
                logger.error(f"Invalid UUID format: {e}")
                await voice_tool_call_error(
                    VoiceToolCallErrorPayload(
                        success=False,
                        message=f"Invalid UUID format: {str(e)}",
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
                model_id_uuid_obj,  # Pass UUID object directly
            )
            key_id_uuid_obj = None
            if key_id_row and key_id_row["key_id"]:
                try:
                    key_id_uuid_obj = uuid.UUID(key_id_row["key_id"])
                except (ValueError, TypeError):
                    logger.warning(f"Invalid key_id format from database: {key_id_row['key_id']}")

            # Convert profile_id to UUID object if present
            profile_id_uuid_obj = None
            if profile_id_val:
                try:
                    profile_id_uuid_obj = uuid.UUID(str(profile_id_val))
                except (ValueError, TypeError):
                    logger.warning(f"Invalid profile_id format: {profile_id_val}")

            # Get Simulation Voice Agent ID from persona_agents table (required for runs table)
            # Personas are linked to agents via persona_agents junction table
            simulation_agent_row = await conn.fetchrow(
                """
                SELECT pa.agent_id
                FROM persona_agents pa
                JOIN agents a ON a.id = pa.agent_id
                WHERE pa.persona_id = $1::uuid 
                AND pa.active = true 
                AND a.role = 'simulation-voice'
                AND a.active = true
                LIMIT 1
                """,
                persona_id_uuid_obj,
            )
            if not simulation_agent_row:
                logger.error(f"Simulation Voice Agent not found for persona {persona_id}")
                await voice_tool_call_error(
                    VoiceToolCallErrorPayload(
                        success=False,
                        message=f"Simulation Voice Agent not found for persona {persona_id}",
                    ),
                    room=sid,
                )
                return
            
            # Ensure agent_id is a UUID object
            agent_id_value = simulation_agent_row["agent_id"]
            if isinstance(agent_id_value, str):
                simulation_agent_id = uuid.UUID(agent_id_value)
            elif isinstance(agent_id_value, uuid.UUID):
                simulation_agent_id = agent_id_value
            else:
                logger.error(f"Invalid agent_id type: {type(agent_id_value)}")
                await voice_tool_call_error(
                    VoiceToolCallErrorPayload(
                        success=False,
                        message="Invalid agent_id format",
                    ),
                    room=sid,
                )
                return

            # Get or create run for this chat
            sql_get_or_create_run = load_sql(
                "sql/v3/simulations/get_or_create_run_for_chat.sql"
            )
            
            # Debug log: Show all UUIDs being passed to the query
            logger.info(
                f"Calling get_or_create_run_for_chat with: "
                f"chat_id={chat_id_uuid}, department_id={department_id_uuid_obj}, "
                f"model_id={model_id_uuid_obj}, persona_id={persona_id_uuid_obj}, "
                f"profile_id={profile_id_uuid_obj}, key_id={key_id_uuid_obj}, "
                f"agent_id={simulation_agent_id}"
            )
            
            # Pass UUID objects directly - asyncpg can infer types from UUID objects
            # This avoids type inference issues when None values are present
            run_row = await conn.fetchrow(
                sql_get_or_create_run,
                chat_id_uuid,  # $1: chat_id (UUID object)
                department_id_uuid_obj,  # $2: department_id (UUID object)
                model_id_uuid_obj,  # $3: model_id (UUID object)
                persona_id_uuid_obj,  # $4: entity_id (UUID object)
                "persona",  # $5: entity_type (string)
                profile_id_uuid_obj,  # $6: profile_id (UUID object or None)
                key_id_uuid_obj,  # $7: key_id (UUID object or None)
                simulation_agent_id,  # $8: agent_id (simulation agent UUID)
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

            # Get latest message in chat to use as parent for message_tree
            # (messages with no active children are the latest/leaf nodes)
            latest_message_row = await conn.fetchrow(
                """
                SELECT m.id
                FROM messages m
                JOIN message_runs mr ON mr.message_id = m.id
                JOIN chat_runs cr ON cr.run_id = mr.run_id
                WHERE cr.chat_id = $1::uuid
                  AND NOT EXISTS (
                      SELECT 1 FROM message_tree mt 
                      WHERE mt.parent_id = m.id AND mt.active = true
                  )
                ORDER BY m.created_at DESC
                LIMIT 1
                """,
                chat_id_uuid,
            )

            # Create message_tree branch if parent message exists
            if latest_message_row and latest_message_row["id"] != assistant_message["id"]:
                parent_message_id = latest_message_row["id"]
                sql_branch = load_sql("sql/v3/simulations/create_message_branch.sql")
                await conn.execute(
                    sql_branch,
                    str(parent_message_id),
                    str(assistant_message["id"]),
                )
                logger.info(
                    f"Created message_tree branch from {parent_message_id} to assistant message {assistant_message['id']}"
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
                f"Streamed persona message from persona_id={persona_id} for chat {chat_id}"
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

