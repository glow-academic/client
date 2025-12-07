"""Handler for start_voice WebSocket event."""

import inspect
import json
import uuid
from typing import Any, get_type_hints

from app.api.v3.realtime.ephemeral_key import _generate_ephemeral_key_internal
from app.main import _voice_sessions, get_pool, sio
from app.utils.agents.build_orchestrator_agent import build_orchestrator_agent
from app.utils.agents.tools.create_persona_tools import create_persona_tools
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)


# Pydantic models
class StartVoicePayload(BaseModel):
    """Client-to-server payload for start_voice."""

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
    persona_tools: list[dict[str, str]]  # List of {name, description, parameters} for each tool
    tool_context_map: dict[str, PersonaToolContext]  # Map of tool_name -> PersonaToolContext
    instructions: str  # Orchestrator instructions telling model to use tools
    model: str  # Model name (e.g., "gpt-realtime-mini")
    voice: str | None = None  # Voice ID for audio output
    transcription_model: str | None = None  # Transcription model (e.g., "gpt-4o-mini-transcribe")
    transcription_prompt: str | None = None  # Transcription prompt
    audio_enabled: bool = True  # Whether audio output is enabled
    text_enabled: bool = True  # Whether text output is enabled


# Emit helper functions
async def start_voice_error(payload: StartVoiceErrorPayload, room: str) -> None:
    await sio.emit("start_voice_error", payload.model_dump(), room=room)


async def start_voice_response(
    payload: StartVoiceResponsePayload, room: str
) -> None:
    await sio.emit("start_voice_response", payload.model_dump(), room=room)


async def _start_voice_impl(sid: str, data: StartVoicePayload) -> None:
    """Handle voice session start requests via WebSocket."""
    try:
        logger.info(f"Received start_voice request from {sid} with data: {data}")

        chat_id = data.chat_id
        if not chat_id:
            logger.error(f"Missing chat_id in request from {sid}")
            await start_voice_error(
                StartVoiceErrorPayload(success=False, message="Missing chat_id"),
                room=sid,
            )
            return

        chat_id_uuid = uuid.UUID(chat_id)

        # Get connection pool
        pool = get_pool()
        if not pool:
            await start_voice_error(
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
                logger.info(f"Generated ephemeral key for chat {chat_id} (expires in {expires_in}s)")
            except Exception as e:
                logger.error(f"Failed to generate ephemeral key: {e}", exc_info=True)
                await start_voice_error(
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
                await start_voice_error(
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
                await start_voice_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message="No personas found for this scenario",
                    ),
                    room=sid,
                )
                return

            personas = [dict(row) for row in persona_rows]

            # Build context for orchestrator agent
            context = {
                "model_name": context_row["model_name"],
                "provider_name": context_row["provider"],
                "base_url": context_row.get("base_url", ""),
                "api_key": context_row["api_key"],
                "temperature": float(context_row.get("temperature", 0.7)),
                "reasoning": context_row.get("reasoning"),
            }

            # Get or create run_id for persona tools
            # We need: department_id, model_id, persona_id, agent_id, key_id, profile_id
            department_id_str = context_row.get("department_id")
            model_id_str = context_row.get("model_id")
            profile_id_str = context_row.get("profile_id")
            
            if not department_id_str or not model_id_str:
                await start_voice_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message="Missing department_id or model_id in context",
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
                await start_voice_error(
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
                profile_id_uuid = uuid.UUID(str(profile_id_str)) if profile_id_str else None
            except (ValueError, TypeError) as e:
                logger.error(f"Invalid UUID format: {e}")
                await start_voice_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message=f"Invalid UUID format: {str(e)}",
                    ),
                    room=sid,
                )
                return
            
            # Get key_id from model_keys table
            key_id_row = await conn.fetchrow(
                """
                SELECT mk.key_id::text as key_id
                FROM model_keys mk
                WHERE mk.model_id = $1::uuid AND mk.active = true
                LIMIT 1
                """,
                model_id_uuid,
            )
            key_id_uuid = None
            if key_id_row and key_id_row["key_id"]:
                try:
                    key_id_uuid = uuid.UUID(key_id_row["key_id"])
                except (ValueError, TypeError):
                    logger.warning(f"Invalid key_id format from database: {key_id_row['key_id']}")
            
            # Get Simulation Voice Agent ID for first persona
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
                first_persona_id_uuid,
            )
            if not simulation_agent_row:
                await start_voice_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message=f"Simulation Voice Agent not found for persona {first_persona_id_str}",
                    ),
                    room=sid,
                )
                return
            
            agent_id_value = simulation_agent_row["agent_id"]
            if isinstance(agent_id_value, str):
                simulation_agent_id = uuid.UUID(agent_id_value)
            elif isinstance(agent_id_value, uuid.UUID):
                simulation_agent_id = agent_id_value
            else:
                await start_voice_error(
                    StartVoiceErrorPayload(
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
                await start_voice_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message="Failed to get or create run for chat",
                    ),
                    room=sid,
                )
                return
            
            model_run_id = uuid.UUID(run_row["run_id"])
            
            # Import emit functions from send_message
            from app.socket.simulations.send_message import (
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

            # Build tool context map: tool_name -> PersonaToolContext
            # Import sanitize function to match tool names
            from app.utils.agents.tools.create_persona_tools import \
                sanitize_persona_name
            
            tool_context_map: dict[str, PersonaToolContext] = {}
            profile_id = context_row.get("profile_id")
            
            # Build map by iterating through personas and matching to tools
            for persona in personas:
                persona_id_str = persona.get("persona_id") or persona.get("id")
                persona_name = persona.get("persona_name") or persona.get("name", "")
                
                if not persona_id_str:
                    logger.warning(f"Persona missing id field: {persona}, skipping")
                    continue
                
                # Generate expected tool name using same sanitization
                expected_tool_name = f"speak_{sanitize_persona_name(persona_name)}"
                
                # Find matching tool
                matching_tool = None
                for tool in persona_tools:
                    if tool.name == expected_tool_name:
                        matching_tool = tool
                        break
                
                if not matching_tool:
                    logger.warning(
                        f"Could not find tool {expected_tool_name} for persona {persona_name}, skipping context map entry"
                    )
                    continue
                
                tool_context_map[matching_tool.name] = PersonaToolContext(
                    persona_id=str(persona_id_str),
                    profile_id=str(profile_id) if profile_id else None,
                )

            # Build orchestrator agent (we'll use it when processing realtime events)
            orchestrator_agent = build_orchestrator_agent(context, persona_tools)
            
            # Extract orchestrator instructions from the agent
            # The instructions are in the agent's system_prompt
            orchestrator_instructions = ""
            if hasattr(orchestrator_agent, "agent"):
                agent_instance = orchestrator_agent.agent()
                if hasattr(agent_instance, "instructions"):
                    instructions_value = getattr(agent_instance, "instructions", "")
                    if isinstance(instructions_value, str):
                        orchestrator_instructions = instructions_value
                elif hasattr(agent_instance, "system_prompt"):
                    prompt_value = getattr(agent_instance, "system_prompt", "")
                    if isinstance(prompt_value, str):
                        orchestrator_instructions = prompt_value
            
            # If we couldn't get it from the agent, construct it manually
            if not orchestrator_instructions:
                persona_names = [tool.name.replace("speak_", "").replace("_", " ") for tool in persona_tools]
                orchestrator_instructions = f"""You are an orchestrator managing a multi-party conversation.

Available personas:
{chr(10).join(f"- {name}" for name in persona_names)}

Your role:
- Listen to the user's input
- Decide which persona should respond based on the context
- Call the appropriate persona tool (speak_{{persona_name}}) to make that persona respond
- Never respond directly - always use a persona tool

When a persona tool is called, that persona will generate and speak the response.
You should call exactly one persona tool per user message."""

            # Store orchestrator agent in a session store (we'll use Redis or in-memory dict)
            # For now, we'll store it per chat_id in a global dict
            # In production, use Redis for multi-server support
            # Note: context_row and personas are no longer needed - context is sent to client
            _voice_sessions[str(chat_id_uuid)] = {
                "orchestrator_agent": orchestrator_agent,
                "context": context,  # Keep for orchestrator agent if needed
            }

            # Format persona tools for client (include parameters for RealtimeAgent)
            persona_tools_response: list[dict[str, str]] = []
            for tool in persona_tools:
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
                            if hasattr(param_default, "__class__") and param_default.__class__.__name__ == "FieldInfo":
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
                                if hasattr(field_info, "description") and field_info.description:
                                    prop["description"] = str(field_info.description)
                            
                            properties[param_name] = prop
                            
                            # Check if required (no default or default is Field)
                            is_field_default = (
                                hasattr(param.default, "__class__") 
                                and param.default.__class__.__name__ == "FieldInfo"
                            )
                            if param.default == inspect.Parameter.empty or is_field_default:
                                required.append(param_name)
                        
                        tool_parameters = {
                            "type": "object",
                            "properties": properties,
                            "required": required,
                        }
                    except Exception as e:
                        logger.warning(f"Failed to extract schema from tool {tool.name}: {e}")
                        # Fallback: construct schema manually for persona tools
                        tool_parameters = {
                            "type": "object",
                            "properties": {
                                "message": {
                                    "type": "string",
                                    "description": f"Respond as the persona. This is the message that will be said.",
                                }
                            },
                            "required": ["message"],
                        }
                else:
                    # Fallback: construct schema manually for persona tools
                    # All persona tools have the same signature
                    tool_parameters = {
                        "type": "object",
                        "properties": {
                            "message": {
                                "type": "string",
                                "description": f"Respond as the persona. This is the message that will be said.",
                            }
                        },
                        "required": ["message"],
                    }

                persona_tools_response.append(
                    {
                        "name": str(tool.name),
                        "description": str(tool_description),
                        "parameters": json.dumps(tool_parameters),
                    }
                )

            # Build session config with simple typed fields
            # Model defaults to "gpt-realtime-mini" if not specified in context
            model_name = context.get("model_name", "gpt-realtime-mini")
            
            # Default transcription model
            transcription_model_default = "gpt-4o-mini-transcribe"
            
            # For transcript mode, both audio and text should be enabled
            audio_enabled = True
            text_enabled = True

            logger.info(
                f"Started voice session for chat {chat_id} with {len(persona_tools)} persona tools"
            )

            await start_voice_response(
                StartVoiceResponsePayload(
                    success=True,
                    message="Voice session started successfully",
                    ephemeral_key=ephemeral_key,
                    persona_tools=persona_tools_response,
                    tool_context_map=tool_context_map,
                    instructions=orchestrator_instructions,
                    model=model_name,
                    voice=None,  # Can be set from context if available
                    transcription_model=transcription_model_default,
                    transcription_prompt=None,  # Can be set from context if available
                    audio_enabled=audio_enabled,
                    text_enabled=text_enabled,
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(f"Error in start_voice for {sid}: {str(e)}", exc_info=True)
        await start_voice_error(
            StartVoiceErrorPayload(success=False, message=str(e)), room=sid
        )


@sio.event  # type: ignore
async def start_voice(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""
    try:
        validated = StartVoicePayload(**data)
        await _start_voice_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in start_voice for {sid}: {e}")
        await start_voice_error(
            StartVoiceErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )

