"""Handler for simulation_voice_start WebSocket event."""

import inspect
import json
import uuid
from typing import Any, get_type_hints

from app.api.v3.realtime.ephemeral_key import _generate_ephemeral_key_internal
from app.main import _voice_sessions, get_pool, sio
from app.utils.agents.build_voice_agent import build_voice_agent
from app.utils.agents.tools.create_persona_tools import create_persona_tools
from app.utils.chat.get_realtime_history import get_realtime_history
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)


# Pydantic models
class StartVoicePayload(BaseModel):
    """Client-to-server payload for simulation_voice_start."""

    chat_id: str


class StartVoiceErrorPayload(BaseModel):
    """Server-to-client error payload."""

    success: bool
    message: str


class PersonaToolContext(BaseModel):
    """Context for a persona tool call."""

    persona_id: str
    profile_id: str | None


class StartVoiceResponsePayload(BaseModel):
    """Server-to-client response payload."""

    success: bool
    message: str
    ephemeral_key: str
    persona_tools: list[
        dict[str, str]
    ]  # List of {name, description, parameters} for each tool
    tool_context_map: dict[
        str, PersonaToolContext
    ]  # Map of tool_name -> PersonaToolContext
    instructions: str  # Voice agent instructions telling model to use tools
    model: str  # Model name (e.g., "gpt-realtime-mini")
    voice: str | None = None  # Voice ID for audio output
    transcription_model: str | None = (
        None  # Transcription model (e.g., "gpt-4o-mini-transcribe")
    )
    transcription_prompt: str | None = None  # Transcription prompt
    history: list[dict[str, Any]] = []  # Conversation history in RealtimeItem format


# Emit helper functions
async def simulation_voice_start_error(
    payload: StartVoiceErrorPayload, room: str
) -> None:
    await sio.emit("simulation_voice_start_error", payload.model_dump(), room=room)


async def simulation_voice_start_response(
    payload: StartVoiceResponsePayload, room: str
) -> None:
    await sio.emit("simulation_voice_start_response", payload.model_dump(), room=room)


async def _simulation_voice_start_impl(sid: str, data: StartVoicePayload) -> None:
    """Handle voice session start requests via WebSocket."""
    try:
        logger.info(
            f"Received simulation_voice_start request from {sid} with data: {data}"
        )

        chat_id = data.chat_id
        if not chat_id:
            logger.error(f"Missing chat_id in request from {sid}")
            await simulation_voice_start_error(
                StartVoiceErrorPayload(success=False, message="Missing chat_id"),
                room=sid,
            )
            return

        chat_id_uuid = uuid.UUID(chat_id)

        # Get connection pool
        pool = get_pool()
        if not pool:
            await simulation_voice_start_error(
                StartVoiceErrorPayload(
                    success=False, message="Database connection pool not available"
                ),
                room=sid,
            )
            return

        async with pool.acquire() as conn:
            # Generate ephemeral key first
            try:
                ephemeral_key, expires_in = await _generate_ephemeral_key_internal()
                logger.info(
                    f"Generated ephemeral key for chat {chat_id} (expires in {expires_in}s)"
                )
            except Exception as e:
                logger.error(f"Failed to generate ephemeral key: {e}", exc_info=True)
                await simulation_voice_start_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message=f"Failed to generate ephemeral key: {str(e)}",
                    ),
                    room=sid,
                )
                return

            # Get chat context (similar to send_message)
            sql_context = load_sql("sql/v3/agents/get_simulation_run_context.sql")
            context_row = await conn.fetchrow(sql_context, str(chat_id_uuid))

            if not context_row:
                await simulation_voice_start_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message=f"Chat {chat_id} not found or no scenario configured",
                    ),
                    room=sid,
                )
                return

            # Get all personas for this scenario
            sql_personas = load_sql("sql/v3/voice/get_chat_personas.sql")
            persona_rows = await conn.fetch(sql_personas, str(chat_id_uuid))

            if not persona_rows or len(persona_rows) == 0:
                await simulation_voice_start_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message="No personas found for this scenario",
                    ),
                    room=sid,
                )
                return

            personas = [dict(row) for row in persona_rows]

            # Build context for voice agent (use voice fields with fallback to text fields)
            voice_temperature = context_row.get("voice_temperature")
            context = {
                "model_name": context_row.get("voice_model_name")
                or context_row.get("model_name"),
                "provider_name": context_row.get("voice_provider")
                or context_row.get("provider"),
                "base_url": context_row.get("voice_base_url")
                or context_row.get("base_url", ""),
                "api_key": context_row.get("voice_api_key")
                or context_row.get("api_key"),
                "temperature": float(
                    voice_temperature
                    if voice_temperature is not None
                    else context_row.get("temperature", 0.7)
                ),
                "reasoning": context_row.get("voice_reasoning")
                or context_row.get("reasoning"),
            }

            # Get or create run_id for persona tools
            # We need: department_id, model_id, persona_id, agent_id, key_id, profile_id
            # Use voice fields from context
            department_id_str = context_row.get("department_id")
            model_id_str = context_row.get("voice_model_id") or context_row.get(
                "model_id"
            )
            voice_agent_id_str = context_row.get("voice_agent_id")
            profile_id_str = context_row.get("profile_id")

            if not department_id_str or not model_id_str:
                await simulation_voice_start_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message="Missing department_id or voice_model_id in context",
                    ),
                    room=sid,
                )
                return

            if not voice_agent_id_str:
                await simulation_voice_start_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message="Missing voice_agent_id in context",
                    ),
                    room=sid,
                )
                return

            # Get first persona ID for run creation
            first_persona_id_str = None
            for persona in personas:
                persona_id_val = persona.get("persona_id") or persona.get("id")
                if persona_id_val:
                    first_persona_id_str = str(persona_id_val)
                    break

            if not first_persona_id_str:
                await simulation_voice_start_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message="No valid persona ID found",
                    ),
                    room=sid,
                )
                return

            # Convert to UUID objects
            try:
                department_id_uuid = uuid.UUID(str(department_id_str))
                model_id_uuid = uuid.UUID(str(model_id_str))
                first_persona_id_uuid = uuid.UUID(first_persona_id_str)
                profile_id_uuid = (
                    uuid.UUID(str(profile_id_str)) if profile_id_str else None
                )
                simulation_agent_id = uuid.UUID(str(voice_agent_id_str))
            except (ValueError, TypeError) as e:
                logger.error(f"Invalid UUID format: {e}")
                await simulation_voice_start_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message=f"Invalid UUID format: {str(e)}",
                    ),
                    room=sid,
                )
                return

            # Get key_id via settings system: provider -> active settings -> setting_provider_keys
            # Get active settings for profile (or default if no profile)
            if profile_id_uuid:
                # Get active settings for profile
                key_id_row = await conn.fetchrow(
                    """
                    WITH default_settings AS (
                        SELECT s.id as settings_id
                        FROM settings s
                        WHERE s.active = true
                          AND NOT EXISTS (
                              SELECT 1 FROM department_settings sd 
                              WHERE sd.settings_id = s.id AND sd.active = true
                          )
                        LIMIT 1
                    ),
                    profile_primary_department AS (
                        SELECT pd.department_id
                        FROM profile_departments pd
                        WHERE pd.profile_id = $2::uuid 
                          AND pd.is_primary = TRUE 
                          AND pd.active = true
                        LIMIT 1
                    ),
                    dept_specific_settings AS (
                        SELECT s.id as settings_id
                        FROM settings s
                        JOIN department_settings sd ON sd.settings_id = s.id
                        JOIN profile_primary_department ppd ON sd.department_id = ppd.department_id
                        WHERE s.active = true 
                          AND sd.active = true
                        LIMIT 1
                    ),
                    active_settings AS (
                        SELECT 
                            COALESCE(
                                (SELECT settings_id FROM dept_specific_settings),
                                (SELECT settings_id FROM default_settings),
                                (SELECT id FROM settings WHERE active = true LIMIT 1)
                            ) as settings_id
                    )
                    SELECT spk.key_id::text as key_id
                    FROM models m
                    JOIN providers p ON p.id = m.provider_id
                    CROSS JOIN active_settings act_s
                    JOIN setting_provider_keys spk ON spk.provider_id = p.id 
                        AND spk.settings_id = act_s.settings_id 
                        AND spk.active = true
                    JOIN keys k ON k.id = spk.key_id AND k.active = true
                    WHERE m.id = $1::uuid
                    LIMIT 1
                    """,
                    model_id_uuid,
                    profile_id_uuid,
                )
            else:
                # Use default settings if no profile_id
                key_id_row = await conn.fetchrow(
                    """
                    WITH default_settings AS (
                        SELECT s.id as settings_id
                        FROM settings s
                        WHERE s.active = true
                          AND NOT EXISTS (
                              SELECT 1 FROM department_settings sd 
                              WHERE sd.settings_id = s.id AND sd.active = true
                          )
                        LIMIT 1
                    ),
                    active_settings AS (
                        SELECT 
                            COALESCE(
                                (SELECT settings_id FROM default_settings),
                                (SELECT id FROM settings WHERE active = true LIMIT 1)
                            ) as settings_id
                    )
                    SELECT spk.key_id::text as key_id
                    FROM models m
                    JOIN providers p ON p.id = m.provider_id
                    CROSS JOIN active_settings act_s
                    JOIN setting_provider_keys spk ON spk.provider_id = p.id 
                        AND spk.settings_id = act_s.settings_id 
                        AND spk.active = true
                    JOIN keys k ON k.id = spk.key_id AND k.active = true
                    WHERE m.id = $1::uuid
                    LIMIT 1
                    """,
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

            # Get or create run for this chat
            sql_get_or_create_run = load_sql(
                "sql/v3/simulations/get_or_create_run_for_chat.sql"
            )
            run_row = await conn.fetchrow(
                sql_get_or_create_run,
                chat_id_uuid,  # $1: chat_id
                department_id_uuid,  # $2: department_id
                model_id_uuid,  # $3: model_id
                first_persona_id_uuid,  # $4: entity_id (persona_id)
                "persona",  # $5: entity_type
                profile_id_uuid,  # $6: profile_id (can be None)
                key_id_uuid,  # $7: key_id (can be None)
                simulation_agent_id,  # $8: agent_id
            )

            if not run_row:
                await simulation_voice_start_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message="Failed to get or create run for chat",
                    ),
                    room=sid,
                )
                return

            model_run_id = uuid.UUID(run_row["run_id"])

            # Import emit functions from send_message
            from app.socket.v3.simulations.text.send import (
                SimulationMessageCompletePayload,
                SimulationMessageTokenPayload, SimulationNewMessagePayload,
                simulation_message_complete, simulation_message_token,
                simulation_new_message)

            # Create emit wrapper functions for persona tools
            async def emit_new_message_wrapper(event_data: dict[str, Any]) -> None:
                await simulation_new_message(
                    SimulationNewMessagePayload(**event_data),
                    room=f"simulation_{chat_id_uuid}",
                )

            async def emit_token_wrapper(event_data: dict[str, Any]) -> None:
                await simulation_message_token(
                    SimulationMessageTokenPayload(**event_data),
                    room=f"simulation_{chat_id_uuid}",
                )

            async def emit_complete_wrapper(event_data: dict[str, Any]) -> None:
                await simulation_message_complete(
                    SimulationMessageCompletePayload(**event_data),
                    room=f"simulation_{chat_id_uuid}",
                )

            # Create persona tools with all required arguments
            persona_tools = create_persona_tools(
                personas,
                chat_id_uuid,
                conn,
                model_run_id,
                emit_new_message_wrapper,
                emit_token_wrapper,
                emit_complete_wrapper,
                parent_message_id=None,  # No parent message during initialization
            )

            # Tool context map is no longer needed since we have a single speak tool
            # The persona is determined from the tool arguments, not the tool name
            tool_context_map: dict[str, PersonaToolContext] = {}

            # Get base voice system prompt from context (simulation-voice prompt from agent)
            base_voice_system_prompt = context_row.get("voice_system_prompt", "")
            if not base_voice_system_prompt:
                # Fallback to text system prompt if voice prompt not available
                base_voice_system_prompt = context_row.get("system_prompt", "")

            if not base_voice_system_prompt:
                await simulation_voice_start_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message="No voice system prompt found for this scenario",
                    ),
                    room=sid,
                )
                return

            # Get persona instructions only (not full system prompts)
            sql_get_persona_instructions = load_sql(
                "sql/v3/voice/get_persona_instructions.sql"
            )
            persona_instruction_rows = await conn.fetch(
                sql_get_persona_instructions,
                str(chat_id_uuid),
            )

            # Build map of persona_name -> instructions
            persona_instructions_map: dict[str, str] = {}
            for row in persona_instruction_rows:
                persona_name = row.get("persona_name", "")
                instructions = row.get("instructions", "")
                if persona_name:
                    persona_instructions_map[persona_name] = instructions or ""

            # Create debug_info tool for voice agent
            # We need to create a simple wrapper that can be called from Realtime API
            # The actual execution will happen server-side via voice_debug_info event
            from agents import function_tool

            async def debug_info_wrapper(content: str) -> str:
                """Debug info tool wrapper for voice mode.

                This tool is called by the Realtime API agent. The actual execution
                happens server-side via the voice_debug_info WebSocket event.
                """
                # This function is executed client-side by Realtime API
                # The actual server-side handling happens in voice_debug_info handler
                return "Debug info logged"

            debug_info_tool = function_tool(debug_info_wrapper)

            # Add debug_info tool to tools list
            all_tools = list(persona_tools) + [debug_info_tool]

            # Build voice agent with base prompt and persona instructions
            voice_agent, complete_instructions = build_voice_agent(
                context,
                all_tools,
                base_voice_system_prompt,
                persona_instructions_map,
            )

            # Use complete_instructions for RealtimeAgent (this goes to instructions field)
            voice_agent_instructions = complete_instructions

            # Store voice agent in a session store (we'll use Redis or in-memory dict)
            # For now, we'll store it per chat_id in a global dict
            # In production, use Redis for multi-server support
            # Note: context_row and personas are no longer needed - context is sent to client
            _voice_sessions[str(chat_id_uuid)] = {
                "voice_agent": voice_agent,
                "context": context,  # Keep for voice agent if needed
            }

            # Format all tools for client (persona tools + debug_info)
            # Include both persona tools and debug_info tool in the same format
            persona_tools_response: list[dict[str, str]] = []
            for tool in all_tools:
                # Handle different tool types - only FunctionTool has description
                tool_description = ""
                if hasattr(tool, "description"):
                    tool_description = tool.description or f"Tool for {tool.name}"
                else:
                    tool_description = f"Tool for {tool.name}"

                # Extract parameters schema from Tool's underlying function
                # All persona tools have the same signature: message: str = Field(...)
                # Try to get the function from the tool, or construct schema manually
                tool_parameters: dict[str, Any] = {}

                # Try to access the underlying function from the tool
                func = None
                if hasattr(tool, "func"):
                    func = tool.func
                elif hasattr(tool, "_func"):
                    func = tool._func
                elif hasattr(tool, "function"):
                    func = tool.function

                if func:
                    try:
                        # Get function signature and type hints
                        sig = inspect.signature(func)
                        hints = get_type_hints(func, include_extras=True)

                        # Build JSON schema from function parameters
                        properties: dict[str, Any] = {}
                        required: list[str] = []

                        for param_name, param in sig.parameters.items():
                            if param_name == "self":
                                continue

                            param_type = hints.get(param_name, str)
                            param_default = param.default

                            # Check if it's a Field with description
                            field_info = None
                            # Check if param_default is a Field instance
                            if (
                                hasattr(param_default, "__class__")
                                and param_default.__class__.__name__ == "FieldInfo"
                            ):
                                field_info = param_default
                            elif hasattr(param_default, "description"):
                                field_info = param_default

                            # Determine type
                            type_str = "string"
                            if param_type == int:
                                type_str = "integer"
                            elif param_type == float:
                                type_str = "number"
                            elif param_type == bool:
                                type_str = "boolean"

                            prop: dict[str, Any] = {"type": type_str}

                            # Add description if available
                            if field_info:
                                if (
                                    hasattr(field_info, "description")
                                    and field_info.description
                                ):
                                    prop["description"] = str(field_info.description)

                            properties[param_name] = prop

                            # Check if required (no default or default is Field)
                            is_field_default = (
                                hasattr(param.default, "__class__")
                                and param.default.__class__.__name__ == "FieldInfo"
                            )
                            if (
                                param.default == inspect.Parameter.empty
                                or is_field_default
                            ):
                                required.append(param_name)

                        tool_parameters = {
                            "type": "object",
                            "properties": properties,
                            "required": required,
                        }
                    except Exception as e:
                        logger.warning(
                            f"Failed to extract schema from tool {tool.name}: {e}"
                        )
                        # Fallback: construct schema manually based on tool name
                        tool_name_str = str(tool.name)
                        if tool_name_str == "speak":
                            # Speak tool fallback
                            persona_names_list = [
                                f'"{p.get("persona_name") or p.get("name", "")}"'
                                for p in personas
                            ]
                            tool_parameters = {
                                "type": "object",
                                "properties": {
                                    "persona": {
                                        "type": "string",
                                        "description": f"The name of the persona that should speak. Must be one of: {', '.join(persona_names_list)}",
                                    },
                                    "message": {
                                        "type": "string",
                                        "description": "The message content that the persona should say.",
                                    },
                                },
                                "required": ["persona", "message"],
                            }
                        elif tool_name_str == "debug_info":
                            # Debug info tool fallback
                            tool_parameters = {
                                "type": "object",
                                "properties": {
                                    "content": {
                                        "type": "string",
                                        "description": "A short, clear note describing what you were trying to do, what is unclear or failing, what you need to continue, and any assumptions you are considering.",
                                    }
                                },
                                "required": ["content"],
                            }
                        else:
                            # Generic fallback
                            tool_parameters = {
                                "type": "object",
                                "properties": {},
                                "required": [],
                            }
                else:
                    # Fallback: construct schema manually based on tool name
                    tool_name_str = str(tool.name)
                    if tool_name_str == "speak":
                        # Speak tool fallback
                        persona_names_list = [
                            f'"{p.get("persona_name") or p.get("name", "")}"'
                            for p in personas
                        ]
                        tool_parameters = {
                            "type": "object",
                            "properties": {
                                "persona": {
                                    "type": "string",
                                    "description": f"The name of the persona that should speak. Must be one of: {', '.join(persona_names_list)}",
                                },
                                "message": {
                                    "type": "string",
                                    "description": "The message content that the persona should say.",
                                },
                            },
                            "required": ["persona", "message"],
                        }
                    elif tool_name_str == "debug_info":
                        # Debug info tool fallback
                        tool_parameters = {
                            "type": "object",
                            "properties": {
                                "content": {
                                    "type": "string",
                                    "description": "A short, clear note describing what you were trying to do, what is unclear or failing, what you need to continue, and any assumptions you are considering.",
                                }
                            },
                            "required": ["content"],
                        }
                    else:
                        # Generic fallback
                        tool_parameters = {
                            "type": "object",
                            "properties": {},
                            "required": [],
                        }

                # Tool context map is no longer needed for the single speak tool
                # The persona is determined from the tool arguments (persona parameter)

                persona_tools_response.append(
                    {
                        "name": tool_name_str,
                        "description": str(tool_description),
                        "parameters": json.dumps(tool_parameters),
                    }
                )

            # Build session config with simple typed fields
            # Model defaults to "gpt-realtime-mini" if not specified in context
            model_name = context.get("model_name", "gpt-realtime-mini")

            # Default transcription model
            transcription_model_default = "gpt-4o-mini-transcribe"

            # Get conversation history for RealtimeSession
            # Fetch messages using the same SQL as text mode
            sql_messages = load_sql("sql/v3/simulations/get_simulation_messages.sql")
            message_rows = await conn.fetch(sql_messages, str(chat_id_uuid))
            messages = [dict(row) for row in message_rows]

            # Convert messages to RealtimeItem format
            realtime_history = get_realtime_history(messages)

            logger.info(
                f"Started voice session for chat {chat_id} with {len(persona_tools)} persona tools and {len(realtime_history)} history items"
            )

            await simulation_voice_start_response(
                StartVoiceResponsePayload(
                    success=True,
                    message="Voice session started successfully",
                    ephemeral_key=ephemeral_key,
                    persona_tools=persona_tools_response,
                    tool_context_map=tool_context_map,
                    instructions=voice_agent_instructions,
                    model=model_name,
                    voice=None,  # Can be set from context if available
                    transcription_model=transcription_model_default,
                    transcription_prompt=None,  # Can be set from context if available
                    history=realtime_history,
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(
            f"Error in simulation_voice_start for {sid}: {str(e)}", exc_info=True
        )
        await simulation_voice_start_error(
            StartVoiceErrorPayload(success=False, message=str(e)), room=sid
        )


@sio.event  # type: ignore
async def simulation_voice_start(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = StartVoicePayload(**data)
        await _simulation_voice_start_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_voice_start for {sid}: {e}")
        await simulation_voice_start_error(
            StartVoiceErrorPayload(success=False, message=f"Invalid payload: {str(e)}"),
            room=sid,
        )
