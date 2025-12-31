"""Handler for simulation_voice_generate internal event - generates ephemeral key and returns configuration."""

import inspect
import json
import os
import uuid
from datetime import datetime
from typing import Any, get_type_hints

import httpx
from agents import function_tool
from fastapi import APIRouter
from pydantic import BaseModel, Field, ValidationError
from utils.sql_helper import load_sql

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.infra.v3.agents.utils.build_voice_agent import build_voice_agent
from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.main import _voice_sessions, get_internal_sio, sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models
class StartVoicePayload(BaseModel):
    """Request to start a voice simulation session (client event)."""

    chat_id: str


class StartVoiceErrorPayload(BaseModel):
    """Response indicating an error occurred while starting voice simulation."""

    success: bool
    message: str


class SimulationVoiceGeneratePayload(BaseModel):
    """Internal event to generate voice simulation ephemeral key."""

    sid: str
    chat_id: str
    run_id: str
    group_id: str | None = None


class PersonaTool(BaseModel):
    """Persona tool definition for voice agent."""

    name: str
    description: str
    parameters: str  # JSON string of tool parameters schema


class PersonaToolContext(BaseModel):
    """Context for a persona tool call."""

    persona_id: str
    profile_id: str | None


class RealtimeContentItem(BaseModel):
    """Content item within a RealtimeItem message."""

    type: str  # "input_text" | "output_text" | "input_audio" | "output_audio"
    text: str | None = None
    audio: str | None = None
    transcript: str | None = None


class RealtimeItem(BaseModel):
    """RealtimeItem format for conversation history."""

    type: str  # "message"
    role: str  # "user" | "assistant"
    content: list[RealtimeContentItem]
    status: str  # "completed" | "in_progress" | etc.
    itemId: str | None = None


class StartVoiceResponsePayload(BaseModel):
    """Response from starting a voice simulation session."""

    success: bool
    message: str
    ephemeral_key: str
    persona_tools: list[PersonaTool]
    tool_context_map: dict[str, PersonaToolContext]
    instructions: str
    model: str
    voice: str | None = None
    transcription_model: str | None = None
    transcription_prompt: str | None = None
    history: list[RealtimeItem] = Field(default_factory=list)


class SimulationVoiceGenerateErrorPayload(BaseModel):
    """Response indicating an error occurred in simulation voice generation."""

    success: bool
    message: str


# Client emission functions
async def simulation_voice_start_error(
    payload: StartVoiceErrorPayload, room: str
) -> None:
    """Emit voice start error to client."""
    await sio.emit("simulations_voice_start_error", payload.model_dump(), room=room)


async def simulation_voice_start_response(
    payload: StartVoiceResponsePayload, room: str
) -> None:
    """Emit voice start response to client."""
    payload_dict = payload.model_dump(exclude_none=True)
    if "history" in payload_dict:
        cleaned_history = []
        for item in payload_dict["history"]:
            cleaned_item = {**item}
            if "content" in cleaned_item:
                cleaned_content = []
                for content_item in cleaned_item["content"]:
                    content_type = content_item.get("type", "")
                    cleaned_content_item = {"type": content_type}
                    if content_type in ("input_text", "output_text"):
                        if content_item.get("text") is not None:
                            cleaned_content_item["text"] = content_item["text"]
                    elif content_type in ("input_audio", "output_audio"):
                        if content_item.get("audio") is not None:
                            cleaned_content_item["audio"] = content_item["audio"]
                        if content_item.get("transcript") is not None:
                            cleaned_content_item["transcript"] = content_item[
                                "transcript"
                            ]
                    else:
                        cleaned_content_item = content_item
                    cleaned_content.append(cleaned_content_item)
                cleaned_item["content"] = cleaned_content
            cleaned_history.append(cleaned_item)
        payload_dict["history"] = cleaned_history
    await sio.emit("simulations_voice_start_response", payload_dict, room=room)


async def _simulation_voice_generate_impl(
    sid: str,
    data: SimulationVoiceGeneratePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
    emit_error_callback: Any | None = None,
) -> None:
    """Handle simulation_voice_generate internal event - generates ephemeral key and returns configuration.

    Args:
        sid: Socket session ID
        data: Generate payload with chat_id and run_id
        profile_id: Profile ID from socket
        group_id: Optional group ID
        emit_error_callback: Optional callback for emitting errors (for client events).
                            If None, emits internal errors via internal_sio.
    """

    # Default error emitter (for internal events)
    async def default_emit_error(message: str) -> None:
        await internal_sio.emit(
            "simulation_voice_error",
            {
                "sid": sid,
                "success": False,
                "message": message,
            },
        )

    emit_error = emit_error_callback if emit_error_callback else default_emit_error

    try:
        chat_id_uuid = uuid.UUID(data.chat_id)
        run_id_uuid = uuid.UUID(data.run_id)
        chat_id_str = data.chat_id
        # Replaced with get_db_connection()

        async with get_db_connection() as conn:
            # Get context (run already exists from member_progress)
            sql_context = load_sql(
                "app/sql/v3/simulation_voice/get_voice_run_context_complete.sql"
            )
            context_row = await conn.fetchrow(
                sql_context, str(chat_id_uuid), str(run_id_uuid)
            )

            if not context_row:
                await emit_error(f"Chat {chat_id_str} or run {data.run_id} not found")
                return

            # Get all personas for this scenario
            sql_personas = load_sql("app/sql/v3/voice/get_chat_personas.sql")
            persona_rows = await conn.fetch(sql_personas, str(chat_id_uuid))

            if not persona_rows or len(persona_rows) == 0:
                await emit_error("No personas found for this scenario")
                return

            personas = [dict(row) for row in persona_rows]

            # Build context for voice agent (use voice fields with fallback to text fields)
            voice_temperature = context_row.get("voice_temperature")
            model_name = context_row.get("voice_model_name") or context_row.get(
                "model_name"
            )
            context = {
                "model_name": model_name,
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

            # Generate ephemeral key using model from database context
            ephemeral_model = model_name or "gpt-realtime-mini"
            try:
                openai_api_key = os.getenv("OPENAI_API_KEY")
                if not openai_api_key:
                    raise ValueError("OPENAI_API_KEY not configured")

                async with httpx.AsyncClient() as http_client:
                    response = await http_client.post(
                        "https://api.openai.com/v1/realtime/client_secrets",
                        headers={
                            "Authorization": f"Bearer {openai_api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "session": {
                                "type": "realtime",
                                "model": ephemeral_model,
                            }
                        },
                        timeout=30.0,
                    )
                    response.raise_for_status()
                    response_data = response.json()
                    ephemeral_key = response_data.get("value")
                    expires_in = response_data.get("expires_in", 3600)

                    if not ephemeral_key:
                        raise ValueError("No ephemeral key in response")

            except Exception as e:
                await emit_error(f"Failed to generate ephemeral key: {str(e)}")
                return

            # Get voice agent ID from context
            voice_agent_id_str = context_row.get("voice_agent_id")
            if not voice_agent_id_str:
                await emit_error("Missing voice_agent_id in context")
                return

            simulation_agent_id = uuid.UUID(str(voice_agent_id_str))

            # Create persona tools inline
            sql_get_agent_tools = load_sql("app/sql/v3/agents/get_agent_tools.sql")
            rows = await conn.fetch(sql_get_agent_tools, str(simulation_agent_id))
            agent_tools_config = [dict(row) for row in rows]
            tool_config_map_voice: dict[str, dict[str, Any]] = {
                tool_config["name"]: tool_config for tool_config in agent_tools_config
            }

            # Build speak tool inline
            speak_config = tool_config_map_voice.get("speak")
            if speak_config:
                persona_desc = speak_config.get("argument_descriptions", {}).get(
                    "persona", "The name of the persona that should speak"
                )
                message_desc = speak_config.get("argument_descriptions", {}).get(
                    "message", "The message content that the persona should say"
                )
            else:
                persona_names = []
                for persona in personas:
                    persona_name = persona.get("persona_name") or persona.get(
                        "name", ""
                    )
                    if persona_name:
                        persona_names.append(persona_name)

                if persona_names:
                    persona_names_str = ", ".join(f'"{name}"' for name in persona_names)
                    persona_desc = f"The name of the persona that should speak. Must be one of: {persona_names_str}."
                else:
                    persona_desc = "The name of the persona that should speak"
                message_desc = "The message content that the persona should say"

            def sanitize_persona_name(name: str) -> str:
                sanitized = "".join(c if c.isalnum() or c == " " else "" for c in name)
                sanitized = sanitized.replace(" ", "_").lower()
                return sanitized or "persona"

            def find_persona_by_name_inline(
                persona_name: str, personas_list: list[dict[str, Any]]
            ) -> tuple[uuid.UUID, str] | None:
                if not persona_name or not persona_name.strip():
                    return None
                persona_name_normalized = persona_name.strip()
                sanitized_search = sanitize_persona_name(persona_name_normalized)
                for persona in personas_list:
                    persona_id_str = persona.get("persona_id") or persona.get("id")
                    if not persona_id_str:
                        continue
                    persona_display_name = persona.get("persona_name") or persona.get(
                        "name", ""
                    )
                    if not persona_display_name:
                        continue
                    if persona_name_normalized.lower() == persona_display_name.lower():
                        try:
                            persona_id = uuid.UUID(str(persona_id_str))
                            return (persona_id, persona_display_name)
                        except (ValueError, TypeError):
                            continue
                    sanitized_persona = sanitize_persona_name(persona_display_name)
                    if sanitized_search == sanitized_persona:
                        try:
                            persona_id = uuid.UUID(str(persona_id_str))
                            return (persona_id, persona_display_name)
                        except (ValueError, TypeError):
                            continue
                for persona in personas_list:
                    persona_id_str = persona.get("persona_id") or persona.get("id")
                    if not persona_id_str:
                        continue
                    persona_display_name = persona.get("persona_name") or persona.get(
                        "name", ""
                    )
                    if not persona_display_name:
                        continue
                    if persona_name_normalized.lower() in persona_display_name.lower():
                        try:
                            persona_id = uuid.UUID(str(persona_id_str))
                            return (persona_id, persona_display_name)
                        except (ValueError, TypeError):
                            continue
                return None

            async def speak(
                persona: str = Field(description=persona_desc),
                message: str = Field(description=message_desc),
            ) -> str:
                """Make a persona speak by calling this tool with the persona name and message."""

                persona_match = find_persona_by_name_inline(
                    persona.strip() if persona else "", personas
                )
                if not persona_match:
                    available_list = "\n".join(
                        f"  - {p.get('persona_name') or p.get('name', '')}"
                        for p in personas
                    )
                    error_msg = f"Persona '{persona}' not found. Available personas:\n{available_list}"
                    return f"Error: {error_msg}"

                persona_id, persona_display_name = persona_match

                return f"Tool call confirmed for {persona_display_name}"

            persona_tools = [function_tool(speak)]

            # Create debug_info tool
            async def debug_info_wrapper(content: str) -> str:
                """Debug info tool wrapper for voice mode."""
                return "Debug info logged"

            debug_info_tool = function_tool(debug_info_wrapper)
            all_tools = list(persona_tools) + [debug_info_tool]

            # Get base voice system prompt from context
            base_voice_system_prompt = context_row.get("voice_system_prompt", "")
            if not base_voice_system_prompt:
                base_voice_system_prompt = context_row.get("system_prompt", "")

            if not base_voice_system_prompt:
                await emit_error("No voice system prompt found for this scenario")
                return

            # Get persona instructions
            sql_get_persona_instructions = load_sql(
                "app/sql/v3/voice/get_persona_instructions.sql"
            )
            persona_instruction_rows = await conn.fetch(
                sql_get_persona_instructions, str(chat_id_uuid)
            )

            persona_instructions_map: dict[str, str] = {}
            for row in persona_instruction_rows:
                persona_name = row.get("persona_name", "")
                instructions = row.get("instructions", "")
                if persona_name:
                    persona_instructions_map[persona_name] = instructions or ""

            # Build voice agent with base prompt and persona instructions
            voice_agent, complete_instructions = build_voice_agent(
                context,
                all_tools,
                base_voice_system_prompt,
                persona_instructions_map,
            )

            voice_agent_instructions = complete_instructions

            # Store voice agent in session store
            _voice_sessions[str(chat_id_uuid)] = {
                "voice_agent": voice_agent,
                "context": context,
            }

            # Format all tools for client
            persona_tools_response: list[PersonaTool] = []
            tool_context_map: dict[str, PersonaToolContext] = {}

            for tool in all_tools:
                tool_description = ""
                if hasattr(tool, "description"):
                    tool_description = tool.description or f"Tool for {tool.name}"
                else:
                    tool_description = f"Tool for {tool.name}"

                tool_parameters: dict[str, Any] = {}

                func = None
                if hasattr(tool, "func"):
                    func = tool.func
                elif hasattr(tool, "_func"):
                    func = tool._func
                elif hasattr(tool, "function"):
                    func = tool.function

                if func:
                    try:
                        sig = inspect.signature(func)
                        hints = get_type_hints(func, include_extras=True)

                        properties: dict[str, Any] = {}
                        required: list[str] = []

                        for param_name, param in sig.parameters.items():
                            if param_name == "self":
                                continue

                            param_type = hints.get(param_name, str)
                            param_default = param.default

                            field_info = None
                            if (
                                hasattr(param_default, "__class__")
                                and param_default.__class__.__name__ == "FieldInfo"
                            ):
                                field_info = param_default
                            elif hasattr(param_default, "description"):
                                field_info = param_default

                            type_str = "string"
                            if param_type == int:
                                type_str = "integer"
                            elif param_type == float:
                                type_str = "number"
                            elif param_type == bool:
                                type_str = "boolean"

                            prop: dict[str, Any] = {"type": type_str}

                            if field_info:
                                if (
                                    hasattr(field_info, "description")
                                    and field_info.description
                                ):
                                    prop["description"] = str(field_info.description)

                            properties[param_name] = prop
                            if param_default == inspect.Parameter.empty:
                                required.append(param_name)

                        tool_parameters = {
                            "type": "object",
                            "properties": properties,
                            "required": required,
                        }
                    except Exception as e:
                        tool_parameters = {
                            "type": "object",
                            "properties": {},
                            "required": [],
                        }
                else:
                    tool_parameters = {
                        "type": "object",
                        "properties": {},
                        "required": [],
                    }

                tool_name_str = tool.name if hasattr(tool, "name") else "unknown"
                persona_tools_response.append(
                    PersonaTool(
                        name=tool_name_str,
                        description=str(tool_description),
                        parameters=json.dumps(tool_parameters),
                    )
                )

            # Default transcription model
            transcription_model_default = "gpt-4o-mini-transcribe"

            # Get conversation history for RealtimeSession
            sql_messages = load_sql(
                "app/sql/v3/simulations/get_simulation_messages.sql"
            )
            message_rows = await conn.fetch(sql_messages, str(chat_id_uuid))
            messages = [dict(row) for row in message_rows]

            # Convert messages to RealtimeItem format
            items = [
                msg
                for msg in messages
                if not msg.get("content", "").startswith("Error:")
            ]

            items = sorted(items, key=lambda x: x.get("created_at", datetime.min))

            current_response_messages: list[dict[str, Any]] = []
            realtime_history_dicts: list[dict[str, Any]] = []

            for item in items:
                msg_type = item.get("type", "")
                msg_content = item.get("content", "")
                msg_role = item.get("role", "")

                is_user_message = (msg_type == "query") or (msg_role == "user")
                is_assistant_message = (msg_type == "response") or (
                    msg_role == "assistant"
                )

                if is_user_message and msg_content != "":
                    if current_response_messages:
                        latest_response = current_response_messages[-1]
                        assistant_realtime_item: dict[str, Any] = {
                            "type": "message",
                            "role": "assistant",
                            "content": [
                                {
                                    "type": "output_text",
                                    "text": latest_response.get("content", ""),
                                }
                            ],
                            "status": "completed",
                        }
                        realtime_history_dicts.append(assistant_realtime_item)
                        current_response_messages = []

                    user_realtime_item: dict[str, Any] = {
                        "type": "message",
                        "role": "user",
                        "content": [
                            {
                                "type": "input_text",
                                "text": msg_content,
                            }
                        ],
                        "status": "completed",
                    }
                    realtime_history_dicts.append(user_realtime_item)
                elif is_assistant_message and msg_content != "":
                    current_response_messages.append(item)

            if current_response_messages:
                latest_response = current_response_messages[-1]
                final_assistant_item: dict[str, Any] = {
                    "type": "message",
                    "role": "assistant",
                    "content": [
                        {
                            "type": "output_text",
                            "text": latest_response.get("content", ""),
                        }
                    ],
                    "status": "completed",
                }
                realtime_history_dicts.append(final_assistant_item)

            # Convert dicts to RealtimeItem Pydantic models
            cleaned_history_dicts = []
            for item in realtime_history_dicts:
                cleaned_content = []
                for content_item in item.get("content", []):
                    content_type = content_item.get("type", "")
                    cleaned_item = {"type": content_type}
                    if content_type in ("input_text", "output_text"):
                        if "text" in content_item:
                            cleaned_item["text"] = content_item["text"]
                    elif content_type in ("input_audio", "output_audio"):
                        if "audio" in content_item:
                            cleaned_item["audio"] = content_item["audio"]
                        if "transcript" in content_item:
                            cleaned_item["transcript"] = content_item["transcript"]
                    else:
                        cleaned_item = content_item
                    cleaned_content.append(cleaned_item)
                cleaned_item_dict = {**item, "content": cleaned_content}
                cleaned_history_dicts.append(cleaned_item_dict)

            realtime_history = [RealtimeItem(**item) for item in cleaned_history_dicts]


            # Emit response to client
            await simulation_voice_start_response(
                StartVoiceResponsePayload(
                    success=True,
                    message="Voice session started successfully",
                    ephemeral_key=ephemeral_key,
                    persona_tools=persona_tools_response,
                    tool_context_map=tool_context_map,
                    instructions=voice_agent_instructions,
                    model=model_name,
                    voice=None,
                    transcription_model=transcription_model_default,
                    transcription_prompt=None,
                    history=realtime_history,
                ),
                room=sid,
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="simulations.voice.started",
                    template="{{ actor.name }} started voice simulation",
                    context={"chat_id": chat_id_str},
                    endpoint="/socket/v3/simulations/voice/generate",
                    error=False,
                )
            except Exception as log_error:
    except Exception as e:
        await emit_error(str(e))


async def _simulation_voice_start_impl(sid: str, data: StartVoicePayload) -> None:
    """Handle voice session start requests via WebSocket (client event)."""
    try:
        chat_id = data.chat_id
        if not chat_id:
            await simulation_voice_start_error(
                StartVoiceErrorPayload(success=False, message="Missing chat_id"),
                room=sid,
            )
            return

        chat_id_uuid = uuid.UUID(chat_id)

        # Replaced with get_db_connection()

        async with get_db_connection() as conn:
            # Get chat context (similar to start.py)
            sql_context = load_sql(
                "app/sql/v3/simulations/get_simulation_run_context.sql"
            )
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
            sql_personas = load_sql("app/sql/v3/voice/get_chat_personas.sql")
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

            # Get or create run_id for persona tools
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
                await simulation_voice_start_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message=f"Invalid UUID format: {str(e)}",
                    ),
                    room=sid,
                )
                return

            # Get key_id via settings system
            if profile_id_uuid:
                sql_get_key = load_sql(
                    "app/sql/v3/settings/get_key_id_for_model_with_profile.sql"
                )
                key_id_row = await conn.fetchrow(
                    sql_get_key,
                    model_id_uuid,
                    profile_id_uuid,
                )
            else:
                sql_get_key = load_sql(
                    "app/sql/v3/settings/get_key_id_for_model_default.sql"
                )
                key_id_row = await conn.fetchrow(
                    sql_get_key,
                    model_id_uuid,
                )
            key_id_uuid = None
            if key_id_row and key_id_row["key_id"]:
                try:
                    key_id_uuid = uuid.UUID(key_id_row["key_id"])
                except (ValueError, TypeError):
            # Get or create run for this chat
            sql_get_or_create_run = load_sql(
                "app/sql/v3/simulations/get_or_create_run_for_chat.sql"
            )
            run_row = await conn.fetchrow(
                sql_get_or_create_run,
                chat_id_uuid,
                department_id_uuid,
                model_id_uuid,
                first_persona_id_uuid,
                "persona",
                profile_id_uuid,
                key_id_uuid,
                simulation_agent_id,
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

            # Now call the generate implementation with the run_id
            # We need to get profile_id from socket for the generate impl
            from app.infra.v3.websocket.find_profile_by_socket import (
                find_profile_by_socket,
            )

            profile_id = await find_profile_by_socket(sid)
            if not profile_id:
                await simulation_voice_start_error(
                    StartVoiceErrorPayload(
                        success=False,
                        message="Profile ID not found",
                    ),
                    room=sid,
                )
                return

            # Call the generate implementation with client error handler
            async def emit_client_error(message: str) -> None:
                await simulation_voice_start_error(
                    StartVoiceErrorPayload(success=False, message=message), room=sid
                )

            generate_payload = SimulationVoiceGeneratePayload(
                sid=sid,
                chat_id=chat_id,
                run_id=str(model_run_id),
                group_id=None,
            )
            await _simulation_voice_generate_impl(
                sid=sid,
                data=generate_payload,
                profile_id=profile_id,
                group_id=None,
                emit_error_callback=emit_client_error,
            )

    except Exception as e:
        await simulation_voice_start_error(
            StartVoiceErrorPayload(success=False, message=str(e)), room=sid
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.voice.started",
                template="{{ actor.name }} failed to start voice simulation",
                context={"error": str(e)},
                endpoint="/socket/v3/simulations/voice/start",
                error=True,
            )
        except Exception as log_error:
@sio.event  # type: ignore
async def simulation_voice_start(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler (client event)."""
    try:
        validated = StartVoicePayload(**data)
        await _simulation_voice_start_impl(sid, validated)
    except ValidationError as e:
        await simulation_voice_start_error(
            StartVoiceErrorPayload(success=False, message=f"Invalid payload: {str(e)}"),
            room=sid,
        )
        # Log activity error
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="simulations.voice.started",
                template="{{ actor.name }} failed to start voice simulation (invalid payload)",
                context={"error": str(e)},
                endpoint="/socket/v3/simulations/voice/start",
                error=True,
            )
        except Exception as log_error:
@internal_sio.on("simulation_voice_generate")  # type: ignore
async def simulation_voice_generate_internal(
    data: dict[str, Any],
) -> None:
    """Handle simulation_voice_generate event from internal bus (server-to-server)."""
    from app.infra.v3.websocket.handler_wrapper import handle_internal_event

    await handle_internal_event(
        data=data,
        request_type=SimulationVoiceGeneratePayload,
        handler=_simulation_voice_generate_impl,  # type: ignore[arg-type]
        error_event_name="simulation_voice_error",
        error_response_type=SimulationVoiceGenerateErrorPayload,
    )


# FastAPI endpoints for OpenAPI documentation
@client_router.post("/start", response_model=dict[str, bool])
async def simulation_voice_start_api(request: StartVoicePayload) -> dict[str, bool]:
    """Client-to-server event: Start a voice simulation session."""
    return {"success": True}


@server_router.post("/start_response", response_model=dict[str, bool])
async def simulation_voice_start_response_api(
    request: StartVoiceResponsePayload,
) -> dict[str, bool]:
    """Server-to-client event: Voice simulation start response."""
    return {"success": True}


@server_router.post("/start_error", response_model=dict[str, bool])
async def simulation_voice_start_error_api(
    request: StartVoiceErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while starting voice simulation."""
    return {"success": True}
