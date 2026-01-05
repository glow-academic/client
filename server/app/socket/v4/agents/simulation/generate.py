"""Handler for simulation_text_generate internal event - runs agent and emits to progress/complete."""

import asyncio
import json
import uuid
from datetime import datetime
from typing import Any, cast

from agents import Runner, function_tool, trace
from agents.exceptions import OutputGuardrailTripwireTriggered
from agents.items import TResponseInputItem
from fastapi import APIRouter
from jinja2 import Template
from pydantic import BaseModel, Field
from utils.sql_helper import execute_sql_typed

from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.chat.format_chat_scenario import format_chat_scenario
from app.infra.v4.debug.debug_info import DebugContext
from app.infra.v4.documents.format_document_info import format_document_info
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, get_simulation_tool_calls_dict
from app.sql.types import (
    GetDeveloperInstructionSqlParams,
    GetDeveloperInstructionSqlRow,
    GetSimulationMessagesSqlParams,
    GetSimulationMessagesSqlRow,
    GetSimulationRunContextAndCreateRunSqlParams,
    GetSimulationRunContextAndCreateRunSqlRow,
    LinkDeveloperMessageToRunSqlParams,
)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_CONTEXT = (
    "app/sql/v4/simulations/get_simulation_run_context_and_create_run_complete.sql"
)
SQL_PATH_MESSAGES = "app/sql/v4/simulations_get_simulation_messages_complete.sql"


# Helper functions for incremental JSON parsing (from send.py)
def extract_persona_from_json(json_str: str) -> str | None:
    """Extract persona field from partial JSON string."""
    import re

    match = re.search(r'"persona"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', json_str)
    if match:
        persona_str = match.group(1)
        try:
            return persona_str.encode("utf-8").decode("unicode_escape")
        except Exception:
            return persona_str
    return None


def extract_new_message_chars(
    prev_json: str, new_json: str, last_index: int
) -> tuple[str, int, bool]:
    """Extract new message characters from JSON string incrementally."""
    if len(new_json) <= last_index:
        return "", last_index, False

    message_start_pattern = '"message"'
    message_start_idx = new_json.find(message_start_pattern, 0)
    if message_start_idx == -1:
        return "", last_index, False

    colon_idx = new_json.find(":", message_start_idx)
    if colon_idx == -1:
        return "", last_index, False

    quote_idx = new_json.find('"', colon_idx)
    if quote_idx == -1:
        return "", last_index, False

    message_value_start = quote_idx + 1

    if last_index < message_value_start:
        if len(new_json) > message_value_start:
            start_extracting_from = message_value_start
        elif len(new_json) == message_value_start:
            return "", message_value_start, False
        else:
            return "", last_index, False
    else:
        start_extracting_from = last_index

    new_chars = []
    i = start_extracting_from
    in_message = True
    escape_next = False

    while i < len(new_json):
        char = new_json[i]

        if escape_next:
            new_chars.append(char)
            escape_next = False
            i += 1
            continue

        if char == "\\":
            escape_next = True
            new_chars.append(char)
            i += 1
            continue

        if char == '"' and not escape_next:
            break

        new_chars.append(char)
        i += 1

    new_message = "".join(new_chars)
    return new_message, i, in_message


def find_persona_by_name_inline(
    persona_name: str, personas: list[dict[str, Any]]
) -> tuple[uuid.UUID, str] | None:
    """Find persona by name (case-insensitive, partial match)."""
    persona_name_lower = persona_name.lower().strip()
    for persona in personas:
        p_name = (persona.get("persona_name") or persona.get("name", "")).lower()
        if persona_name_lower in p_name or p_name in persona_name_lower:
            return (
                uuid.UUID(persona["persona_id"]),
                persona.get("persona_name") or persona.get("name", ""),
            )
    return None


def get_simulation_conversation_history(
    messages: list[dict[str, Any]],
) -> tuple[list[TResponseInputItem], dict[str, int]]:
    """Build conversation history from messages (inlined from utils)."""
    include_message_numbers = False
    conversation_history: list[TResponseInputItem] = []
    message_id_map: dict[str, int] = {}
    message_number = 1

    items = [msg for msg in messages if not msg.get("content", "").startswith("Error:")]

    items = sorted(items, key=lambda x: x.get("created_at", datetime.min))

    current_response_messages: list[dict[str, Any]] = []

    for item in items:
        msg_type = item.get("type", "")
        msg_role = item.get("role", "")
        msg_content = item.get("content", "")
        message_id = item.get("id", "")

        is_user_message = (
            msg_type == "query" or msg_role == "user"
        ) and msg_content != ""

        if is_user_message:
            if current_response_messages:
                latest_response = current_response_messages[-1]
                response_id = latest_response.get("id", "")
                content = latest_response.get("content", "")

                if include_message_numbers:
                    content = f"[{message_number}] {content}"
                    if response_id:
                        message_id_map[response_id] = message_number
                    message_number += 1

                assistant_message_item: TResponseInputItem = {
                    "role": "assistant",
                    "content": content,
                }
                conversation_history.append(assistant_message_item)
                current_response_messages = []

            content = msg_content
            if include_message_numbers:
                content = f"[{message_number}] {content}"
                if message_id:
                    message_id_map[message_id] = message_number
                message_number += 1

            user_message_item: TResponseInputItem = {
                "role": "user",
                "content": content,
            }
            conversation_history.append(user_message_item)
        elif (msg_type == "response" or msg_role == "assistant") and msg_content != "":
            current_response_messages.append(item)

    if current_response_messages:
        latest_response = current_response_messages[-1]
        response_id = latest_response.get("id", "")
        content = latest_response.get("content", "")

        if include_message_numbers:
            content = f"[{message_number}] {content}"
            if response_id:
                message_id_map[response_id] = message_number
            message_number += 1

        assistant_message_item: TResponseInputItem = {
            "role": "assistant",
            "content": content,
        }
        conversation_history.append(assistant_message_item)

    return conversation_history, message_id_map


# Pydantic models for internal events
class SimulationTextGeneratePayload(BaseModel):
    """Internal event to generate simulation text response."""

    sid: str
    chat_id: str
    run_id: str
    group_id: str | None = None


class SimulationTextGenerateErrorPayload(BaseModel):
    """Response indicating an error occurred in simulation text generation."""

    success: bool
    message: str


async def _simulation_text_generate_impl(
    sid: str,
    data: SimulationTextGeneratePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle simulation_text_generate internal event - runs agent and emits to progress_complete."""
    try:
        chat_id_uuid = uuid.UUID(data.chat_id)
        run_id_uuid = uuid.UUID(data.run_id)
        chat_id_str = str(chat_id_uuid)

        async with get_db_connection() as conn:
            # Get all context data AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            try:
                params = GetSimulationRunContextAndCreateRunSqlParams(
                    chat_id=chat_id_uuid,
                    profile_id=profile_id,
                    group_id=group_id,
                )
                result = cast(
                    GetSimulationRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH_CONTEXT, params=params),
                )
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                # Check if it's a rate limit error from SQL (PostgreSQL exception)
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    # Extract the user-friendly message (everything after "RATE_LIMIT_EXCEEDED: ")
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await internal_sio.emit(
                        "simulation_text_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": user_msg,
                            "attempt_id": None,  # Context not available yet
                            "simulation_id": None,
                            "operation": "text_generation",
                        },
                    )
                    return
                await internal_sio.emit(
                    "simulation_text_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"Failed to initialize simulation generation: {str(e)}",
                        "attempt_id": None,  # Context not available yet
                        "simulation_id": None,
                        "operation": "text_generation",
                    },
                )
                return

            if not result:
                await internal_sio.emit(
                    "simulation_text_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"No simulation agent configured for chat {data.chat_id}",
                        "attempt_id": None,  # Context not available yet
                        "simulation_id": None,
                        "operation": "text_generation",
                    },
                )
                return

            # Get department_id
            department_id_str = result.department_id
            if not department_id_str:
                await internal_sio.emit(
                    "simulation_text_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "No active departments found in system",
                        "attempt_id": str(result.attempt_id)
                        if result.attempt_id
                        else None,
                        "simulation_id": str(result.simulation_id)
                        if result.simulation_id
                        else None,
                        "operation": "text_generation",
                    },
                )
                return

            department_id = uuid.UUID(str(department_id_str))

            # Build context dict from result
            context = {
                "chat_id": result.chat_id,
                "chat_title": result.chat_title,
                "trace_id": result.trace_id,
                "attempt_id": result.attempt_id,
                "simulation_id": result.simulation_id,
                "scenario_id": result.scenario_id,
                "department_id": result.department_id,
                "problem_statement": result.problem_statement,
                "persona_id": result.persona_id,
                "persona_name": result.persona_name,
                "system_prompt": result.system_prompt,
                "temperature": float(result.temperature)
                if result.temperature is not None
                else 0.0,
                "reasoning": result.reasoning,
                "model_id": result.model_id,
                "model_name": result.model_name,
                "provider": result.provider,
                "base_url": result.base_url,
                "api_key": result.api_key,
                "custom_model": result.custom_model,
                "provider_id": result.provider_id,
                "provider_name": result.provider_name,
                "agent_id": result.agent_id,
                "voice_system_prompt": result.voice_system_prompt,
                "voice_temperature": float(result.voice_temperature)
                if result.voice_temperature is not None
                else 0.0,
                "voice_reasoning": result.voice_reasoning,
                "voice_model_id": result.voice_model_id,
                "voice_model_name": result.voice_model_name,
                "voice_provider": result.voice_provider,
                "voice_base_url": result.voice_base_url,
                "voice_api_key": result.voice_api_key,
                "voice_custom_model": result.voice_custom_model,
                "voice_provider_name": result.voice_provider_name,
                "voice_agent_id": result.voice_agent_id,
                "image_input_enabled": result.image_input_enabled,
                "copy_paste_allowed": result.copy_paste_allowed,
                "profile_id": result.profile_id,
                "documents": result.documents,
            }

            # Build input items
            input_items: list[TResponseInputItem] = []

            # Format document info if documents are available
            if context["documents"]:
                # Convert composite type documents to dict format for format_document_info
                documents_dict = [
                    {
                        "id": doc.id,
                        "name": doc.name,
                        "file_path": doc.file_path,
                        "mime_type": doc.mime_type,
                    }
                    for doc in context["documents"]
                ]
                document_info = format_document_info(
                    documents_dict, context["image_input_enabled"]
                )
                input_items.append(document_info)

            # Get all messages using execute_sql_typed
            messages_params = GetSimulationMessagesSqlParams(chat_id=chat_id_uuid)
            messages_result = cast(
                GetSimulationMessagesSqlRow,
                await execute_sql_typed(
                    conn, SQL_PATH_MESSAGES, params=messages_params
                ),
            )
            # Convert composite type messages to dict format
            messages = [
                {
                    "id": msg.id,
                    "chat_id": msg.chat_id,
                    "role": msg.role,
                    "content": msg.content,
                    "created_at": msg.created_at,
                    "completed": msg.completed,
                    "updated_at": msg.updated_at,
                    "audio": msg.audio,
                    "upload_id": msg.upload_id,
                }
                for msg in (messages_result.messages or [])
            ]

            # Prepare conversation history
            conversation_history, _ = get_simulation_conversation_history(messages)

            # Format chat scenario
            chat_scenario = format_chat_scenario(context["problem_statement"])

            input_items.insert(0, chat_scenario)
            input_items.extend(conversation_history)

            # Get simulation agent ID
            simulation_agent_id = context["agent_id"]
            if not simulation_agent_id:
                raise ValueError(
                    f"Simulation Text Agent not found for simulation {context['simulation_id']}"
                )

            # Get all personas for this scenario and create persona tools
            # Note: get_chat_personas.sql is a simple query - we'll keep it as is for now
            # but should convert to function if needed
            from utils.sql_helper import load_sql

            sql_personas = load_sql("app/sql/v4/voice/get_chat_personas.sql")
            persona_rows = await conn.fetch(sql_personas, str(chat_id_uuid))
            personas = [dict(row) for row in persona_rows]

            # Track parent message for branching (latest user message)
            # Find latest user message from messages list
            parent_message_id_for_branching: uuid.UUID | None = None
            for msg in reversed(messages):
                if msg.get("role") == "user" or msg.get("type") == "query":
                    parent_message_id_for_branching = uuid.UUID(msg["id"])
                    break

            # Track completed tool messages for hint generation
            completed_tool_messages: list[dict[str, Any]] = []

            # Create persona tools if personas exist
            persona_tools = []
            if personas:
                # Load agent tools from database
                # Load agent tools using typed function
                from app.sql.types import GetAgentToolsSqlRow

                simulation_agent_id_uuid = uuid.UUID(simulation_agent_id)
                # Function returns multiple rows, so we call it directly with fetch()
                function_call_sql = (
                    'SELECT * FROM "public"."socket_get_agent_tools_v4"($1)'
                )
                rows = await conn.fetch(function_call_sql, simulation_agent_id_uuid)
                agent_tools_config = [
                    GetAgentToolsSqlRow.model_validate(dict(row)).model_dump()
                    for row in rows
                ]
                tool_config_map_persona: dict[str, dict[str, Any]] = {
                    tool_config["name"]: tool_config
                    for tool_config in agent_tools_config
                }

                # Build speak tool inline
                speak_config = tool_config_map_persona.get("speak")
                if speak_config:
                    persona_desc = speak_config.get("argument_descriptions", {}).get(
                        "persona", "The name of the persona that should speak"
                    )
                    message_desc = speak_config.get("argument_descriptions", {}).get(
                        "message",
                        "The message content that the persona should say",
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
                        persona_names_str = ", ".join(
                            f'"{name}"' for name in persona_names
                        )
                        persona_desc = f"The name of the persona that should speak. Must be one of: {persona_names_str}."
                    else:
                        persona_desc = "The name of the persona that should speak"
                    message_desc = "The message content that the persona should say"

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

                persona_tools.append(function_tool(speak))

                # Get persona instructions for developer message
                # Note: get_persona_instructions.sql is a simple query - we'll keep it as is for now
                # but should convert to function if needed
                sql_get_persona_instructions = load_sql(
                    "app/sql/v4/voice/get_persona_instructions.sql"
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

                persona_names = [
                    p.get("persona_name") or p.get("name", "Unknown") for p in personas
                ]
                persona_descriptions = []
                for persona_name in persona_names:
                    instructions = persona_instructions_map.get(persona_name, "")
                    if instructions:
                        persona_descriptions.append(f"- {persona_name}: {instructions}")
                    else:
                        persona_descriptions.append(f"- {persona_name}")

                persona_names_list = [f'"{name}"' for name in persona_names]

                # Get developer instruction template from database
                developer_message_content: str | None = None
                try:
                    dev_instruction_params = GetDeveloperInstructionSqlParams(
                        instruction_type="persona",
                        agent_role_val="simulation",
                    )
                    dev_instruction_result = cast(
                        GetDeveloperInstructionSqlRow,
                        await execute_sql_typed(
                            conn,
                            "app/sql/v4/developer_instructions/get_developer_instruction_complete.sql",
                            params=dev_instruction_params,
                        ),
                    )
                    if dev_instruction_result and dev_instruction_result.template:
                        # Render Jinja template with persona context
                        template = Template(dev_instruction_result.template)
                        developer_message_content = template.render(
                            persona_descriptions=persona_descriptions,
                            persona_names_list=persona_names_list,
                            persona_names=persona_names,
                        )
                except Exception:
                    # Fallback to hardcoded message if developer instruction not found
                    developer_message_content = f"""Available personas and their personalities:
{chr(10).join(persona_descriptions)}

Tool Usage Instructions:
- You MUST use the `speak` tool to respond as a persona
- The `speak` tool takes two parameters:
  * `persona`: The name of the persona that should speak (must be one of: {", ".join(persona_names_list)})
  * `message`: The message content that the persona should say
- Call exactly one tool per user message
- Never respond directly - always use the `speak` tool
- The persona name must match exactly one of the available personas listed above"""

                if developer_message_content:
                    developer_message_personas: TResponseInputItem = {
                        "role": "developer",
                        "content": developer_message_content,
                    }
                    input_items.append(developer_message_personas)

                    # Link developer message to run
                    try:
                        link_params = LinkDeveloperMessageToRunSqlParams(
                            content=developer_message_content,
                            run_id=run_id_uuid,
                        )
                        await execute_sql_typed(
                            conn,
                            "app/sql/v4/simulations/link_developer_message_to_run_complete.sql",
                            params=link_params,
                        )
                    except Exception:
                        # Log error but continue - message is already in input_items
                        pass

                # Add debug_info tool
                from app.infra.v4.debug.debug_info import debug_info

                persona_tools.append(debug_info)

            # Create agent instance
            agent_instance = GenericAgent(
                agent_name=context["persona_name"],
                system_prompt=context["system_prompt"],
                temperature=context["temperature"],
                model_name=context["model_name"],
                provider=context["provider_name"],
                base_url=context["base_url"],
                reasoning=context["reasoning"],
                api_key=context["api_key"],
                tools=persona_tools,
            )

            # Get tool calls tracking dict for this chat
            tool_calls_dict = get_simulation_tool_calls_dict()
            if chat_id_str not in tool_calls_dict:
                tool_calls_dict[chat_id_str] = {}

            # Track fake_id -> real_id mapping and counter for unique IDs
            fake_id_to_real_id: dict[str, str] = {}
            tool_call_counter = 0

            # Run agent with streaming
            with trace(
                context["chat_title"],
                trace_id=context["trace_id"],
                group_id=context["attempt_id"],
            ):
                result = Runner.run_streamed(
                    agent_instance.agent(),
                    input=input_items,
                    context=DebugContext(conn=conn, run_id=run_id_uuid),
                )

            # Store the result in active runs for potential cancellation
            from app.infra.v4.websocket.store_active_run import store_active_run

            await store_active_run(chat_id_str, result)

            try:
                # Process streaming events
                event_count = 0
                async for event in result.stream_events():
                    event_count += 1

                    # Check for run_item_stream_event to get tool name
                    if hasattr(event, "type") and event.type == "run_item_stream_event":
                        item = getattr(event, "item", None)
                        if item:
                            item_type = (
                                getattr(item, "type", None)
                                if hasattr(item, "type")
                                else None
                            )
                            if item_type == "function_call":
                                item_id = getattr(item, "id", None)
                                tool_name = getattr(item, "name", None)

                                if item_id and tool_name:
                                    if item_id not in tool_calls_dict[chat_id_str]:
                                        tool_calls_dict[chat_id_str][item_id] = {
                                            "name": tool_name,
                                            "response_id": str(item_id),
                                            "arguments_raw": "",
                                            "message_so_far": "",
                                            "persona_so_far": None,
                                            "db_message_id": None,
                                            "last_processed_index": 0,
                                            "in_message": False,
                                            "parent_message_id": parent_message_id_for_branching,
                                        }
                                    else:
                                        tool_calls_dict[chat_id_str][item_id][
                                            "name"
                                        ] = tool_name

                    # Check for raw_response_event and inspect data for tool call deltas
                    if hasattr(event, "type") and event.type == "raw_response_event":
                        event_data = getattr(event, "data", None)
                        if not event_data:
                            continue

                        event_data_type = (
                            getattr(event_data, "type", None)
                            if hasattr(event_data, "type")
                            else None
                        )

                        # Handle response.output_item.added to get tool name and item_id
                        if event_data_type == "response.output_item.added":
                            item = getattr(event_data, "item", None)
                            if item:
                                item_type = (
                                    getattr(item, "type", None)
                                    if hasattr(item, "type")
                                    else None
                                )
                                if item_type == "function_call":
                                    fake_item_id = getattr(item, "id", None)
                                    tool_name = getattr(item, "name", None)
                                    call_id = getattr(item, "call_id", None)

                                    if not fake_item_id:
                                        fake_item_id = getattr(
                                            event_data, "item_id", None
                                        )

                                    if call_id:
                                        real_item_id = call_id
                                    elif fake_item_id:
                                        tool_call_counter += 1
                                        real_item_id = f"{chat_id_str}_{tool_call_counter}_{uuid.uuid4().hex[:8]}"
                                    else:
                                        continue

                                    if tool_name:
                                        if fake_item_id:
                                            fake_id_to_real_id[fake_item_id] = (
                                                real_item_id
                                            )

                                        if real_item_id in tool_calls_dict[chat_id_str]:
                                            continue

                                        if real_item_id in tool_calls_dict[chat_id_str]:
                                            existing_state = tool_calls_dict[
                                                chat_id_str
                                            ][real_item_id]
                                            existing_state["name"] = tool_name
                                            existing_state["call_id"] = call_id

                                            if existing_state["arguments_raw"]:
                                                accumulated_raw = existing_state[
                                                    "arguments_raw"
                                                ]

                                                if not existing_state["persona_so_far"]:
                                                    persona = extract_persona_from_json(
                                                        accumulated_raw
                                                    )
                                                    if persona:
                                                        existing_state[
                                                            "persona_so_far"
                                                        ] = persona

                                                (
                                                    new_message_chars,
                                                    new_index,
                                                    in_message,
                                                ) = extract_new_message_chars(
                                                    "", accumulated_raw, 0
                                                )
                                                existing_state[
                                                    "last_processed_index"
                                                ] = new_index
                                                existing_state["in_message"] = (
                                                    in_message
                                                )
                                                if new_message_chars:
                                                    existing_state["message_so_far"] = (
                                                        new_message_chars
                                                    )
                                        else:
                                            tool_calls_dict[chat_id_str][
                                                real_item_id
                                            ] = {
                                                "name": tool_name,
                                                "response_id": real_item_id,
                                                "call_id": call_id,
                                                "fake_id": fake_item_id,
                                                "arguments_raw": "",
                                                "message_so_far": "",
                                                "persona_so_far": None,
                                                "db_message_id": None,
                                                "db_tool_call_id": None,
                                                "last_processed_index": 0,
                                                "in_message": False,
                                                "parent_message_id": parent_message_id_for_branching,
                                                "completed": False,
                                            }

                                            # Emit tool call start to progress
                                            await internal_sio.emit(
                                                "simulation_text_progress",
                                                {
                                                    "sid": sid,
                                                    "type": "tool_call_start",
                                                    "chat_id": chat_id_str,
                                                    "run_id": str(run_id_uuid),
                                                    "tool_call_id": real_item_id,
                                                    "call_id": call_id or real_item_id,
                                                    "tool_name": tool_name,
                                                    "arguments_raw": "",
                                                },
                                            )

                        # Handle response.function_call_arguments.delta
                        if event_data_type == "response.function_call_arguments.delta":
                            fake_item_id = getattr(event_data, "item_id", None)
                            arguments_delta = getattr(event_data, "delta", None)
                            call_id = getattr(event_data, "call_id", None)

                            if not arguments_delta:
                                continue

                            if call_id:
                                delta_real_item_id = call_id
                            elif fake_item_id:
                                delta_real_item_id = fake_id_to_real_id.get(
                                    fake_item_id
                                )
                                if not delta_real_item_id:
                                    continue
                            else:
                                continue

                            if not delta_real_item_id:
                                continue

                            tool_call_id = delta_real_item_id

                            if tool_call_id not in tool_calls_dict[chat_id_str]:
                                tool_calls_dict[chat_id_str][tool_call_id] = {
                                    "name": None,
                                    "response_id": str(tool_call_id),
                                    "call_id": call_id,
                                    "arguments_raw": "",
                                    "message_so_far": "",
                                    "persona_so_far": None,
                                    "db_message_id": None,
                                    "db_tool_call_id": None,
                                    "last_processed_index": 0,
                                    "in_message": False,
                                    "parent_message_id": parent_message_id_for_branching,
                                    "completed": False,
                                }

                            tool_call_state = tool_calls_dict[chat_id_str][tool_call_id]

                            if tool_call_state["name"] is None:
                                tool_call_state["arguments_raw"] += arguments_delta
                                continue

                            if tool_call_state["name"] != "speak":
                                continue

                            prev_raw = tool_call_state["arguments_raw"]
                            tool_call_state["arguments_raw"] += arguments_delta
                            new_raw = tool_call_state["arguments_raw"]

                            # Extract persona if available
                            if not tool_call_state["persona_so_far"]:
                                persona = extract_persona_from_json(new_raw)
                                if persona:
                                    tool_call_state["persona_so_far"] = persona

                            # Extract new message content incrementally
                            (
                                new_message_chars,
                                new_index,
                                in_message,
                            ) = extract_new_message_chars(
                                prev_raw,
                                new_raw,
                                tool_call_state["last_processed_index"],
                            )
                            tool_call_state["last_processed_index"] = new_index
                            tool_call_state["in_message"] = in_message

                            if new_message_chars:
                                tool_call_state["message_so_far"] += new_message_chars

                                # Emit token to progress (will handle DB update and client emission)
                                await internal_sio.emit(
                                    "simulation_text_progress",
                                    {
                                        "sid": sid,
                                        "type": "message_token",
                                        "chat_id": chat_id_str,
                                        "run_id": str(run_id_uuid),
                                        "tool_call_id": tool_call_id,
                                        "call_id": call_id or tool_call_id,
                                        "tool_name": tool_call_state["name"],
                                        "token": new_message_chars,
                                        "accumulated_content": tool_call_state[
                                            "message_so_far"
                                        ],
                                        "arguments_raw": new_raw,
                                        "persona_so_far": tool_call_state[
                                            "persona_so_far"
                                        ],
                                        "parent_message_id": str(
                                            parent_message_id_for_branching
                                        )
                                        if parent_message_id_for_branching
                                        else None,
                                    },
                                )

                    # Check for tool call completion
                    if hasattr(event, "type") and event.type == "raw_response_event":
                        event_data = getattr(event, "data", None)
                        if event_data:
                            event_data_type = (
                                getattr(event_data, "type", None)
                                if hasattr(event_data, "type")
                                else None
                            )
                            if event_data_type == "response.output_item.done":
                                fake_item_id = getattr(event_data, "item_id", None)
                                item = getattr(event_data, "item", None)
                                call_id = None
                                if item:
                                    call_id = getattr(item, "call_id", None)
                                if not call_id:
                                    call_id = getattr(event_data, "call_id", None)

                                if call_id:
                                    done_real_item_id = call_id
                                elif fake_item_id:
                                    done_real_item_id = fake_id_to_real_id.get(
                                        fake_item_id
                                    )
                                else:
                                    continue

                                if not done_real_item_id:
                                    continue

                                if done_real_item_id in tool_calls_dict.get(
                                    chat_id_str, {}
                                ):
                                    tool_call_id = done_real_item_id
                                    tool_call_state = tool_calls_dict[chat_id_str][
                                        tool_call_id
                                    ]

                                    if tool_call_state.get("name") != "speak":
                                        continue

                                    if tool_call_state.get("completed"):
                                        continue

                                    tool_call_state["completed"] = True

                                    # Use already-extracted values, only parse JSON if needed for final values
                                    final_message = tool_call_state["message_so_far"]
                                    final_persona = tool_call_state["persona_so_far"]

                                    # Try to extract final values from JSON if arguments_raw is complete
                                    # This is safe because we're parsing a complete JSON string, not streaming
                                    if tool_call_state["arguments_raw"]:
                                        try:
                                            final_args = json.loads(
                                                tool_call_state["arguments_raw"]
                                            )
                                            # Only update if we got valid values
                                            if "message" in final_args:
                                                final_message = final_args["message"]
                                            if (
                                                "persona" in final_args
                                                and not final_persona
                                            ):
                                                final_persona = final_args["persona"]
                                        except json.JSONDecodeError:
                                            # If JSON parsing fails, use already-extracted values
                                            pass

                                    tool_call_state["message_so_far"] = final_message
                                    if (
                                        final_persona
                                        and not tool_call_state["persona_so_far"]
                                    ):
                                        tool_call_state["persona_so_far"] = (
                                            final_persona
                                        )

                                    # Emit completion to complete handler
                                    await internal_sio.emit(
                                        "simulation_text_complete",
                                        {
                                            "sid": sid,
                                            "type": "tool_call_complete",
                                            "chat_id": chat_id_str,
                                            "run_id": str(run_id_uuid),
                                            "tool_call_id": tool_call_id,
                                            "call_id": call_id or tool_call_id,
                                            "tool_name": tool_call_state["name"],
                                            "final_message": final_message,
                                            "final_persona": final_persona,
                                            "arguments_raw": tool_call_state[
                                                "arguments_raw"
                                            ],
                                        },
                                    )

                                    completed_tool_messages.append(
                                        {
                                            "id": tool_call_state.get("db_message_id"),
                                            "content": final_message,
                                        }
                                    )

                                    del tool_calls_dict[chat_id_str][tool_call_id]

            except BaseException as stream_error:
                if isinstance(
                    stream_error,
                    (asyncio.CancelledError, KeyboardInterrupt, SystemExit),
                ):
                    raise
                raise
            except Exception:
                raise
            finally:
                # Complete any remaining tool calls
                if chat_id_str in tool_calls_dict and tool_calls_dict[chat_id_str]:
                    try:
                        async with get_db_connection() as cleanup_conn:
                            for tool_call_id, tool_call_state in list(
                                tool_calls_dict[chat_id_str].items()
                            ):
                                try:
                                    db_message_id = tool_call_state.get("db_message_id")
                                    if db_message_id and tool_call_state.get(
                                        "message_so_far"
                                    ):
                                        final_message = tool_call_state[
                                            "message_so_far"
                                        ]

                                        # Try to extract final message from JSON if available
                                        # This is safe because we're parsing a complete JSON string, not streaming
                                        if tool_call_state.get("arguments_raw"):
                                            try:
                                                final_args = json.loads(
                                                    tool_call_state["arguments_raw"]
                                                )
                                                if "message" in final_args:
                                                    final_message = final_args[
                                                        "message"
                                                    ]
                                            except json.JSONDecodeError:
                                                # If JSON parsing fails, use already-extracted value
                                                pass

                                        await internal_sio.emit(
                                            "simulation_text_complete",
                                            {
                                                "sid": sid,
                                                "type": "tool_call_complete",
                                                "chat_id": chat_id_str,
                                                "run_id": str(run_id_uuid),
                                                "tool_call_id": tool_call_id,
                                                "call_id": tool_call_state.get(
                                                    "call_id"
                                                )
                                                or tool_call_id,
                                                "tool_name": tool_call_state.get(
                                                    "name", "speak"
                                                ),
                                                "final_message": final_message,
                                                "final_persona": tool_call_state.get(
                                                    "persona_so_far"
                                                ),
                                                "arguments_raw": tool_call_state.get(
                                                    "arguments_raw", ""
                                                ),
                                            },
                                        )

                                        completed_tool_messages.append(
                                            {
                                                "id": db_message_id,
                                                "content": final_message,
                                            }
                                        )
                                except Exception:
                                    pass
                    except Exception:
                        pass
                # Clean up tool call states
                if chat_id_str in tool_calls_dict:
                    del tool_calls_dict[chat_id_str]

                # Clean up active run
                from app.infra.v4.websocket.remove_active_run import (
                    remove_active_run,
                )

                await remove_active_run(chat_id_str)

            # Emit async pricing event
            usage = result.context_wrapper.usage
            await internal_sio.emit(
                "log_run",
                {
                    "run_id": str(run_id_uuid),
                    "operation_type": "simulation",
                    "input_text_tokens": usage.input_tokens,
                    "output_text_tokens": usage.output_tokens,
                    "system_prompt": context.get("system_prompt"),
                    "input_items": input_items,
                    "assistant_output": None,
                    "department_id": str(context.get("department_id")) if context.get("department_id") else None,
                },
            )

            # Emit run complete event
            await internal_sio.emit(
                "simulation_text_complete",
                {
                    "sid": sid,
                    "type": "run_complete",
                    "chat_id": chat_id_str,
                    "run_id": str(run_id_uuid),
                },
            )

            # Trigger hint generation for practice simulations
            if completed_tool_messages:
                last_tool_message = completed_tool_messages[-1]

                # Note: get_simulation_metadata_for_chat.sql is a simple query - we'll keep it as is for now
                # but should convert to function if needed
                sql = load_sql(
                    "app/sql/v4/simulations/get_simulation_metadata_for_chat.sql"
                )
                sim_metadata_row = await conn.fetchrow(sql, str(chat_id_uuid))
                if not sim_metadata_row:
                    sim_metadata = {"practice_simulation": False}
                else:
                    sim_metadata = {
                        "simulation_id": sim_metadata_row["simulation_id"],
                        "attempt_id": sim_metadata_row["attempt_id"],
                        "practice_simulation": sim_metadata_row["practice_simulation"],
                    }

                if sim_metadata["practice_simulation"]:
                    # Note: get_simulation_run_context.sql is a simple query - we'll keep it as is for now
                    # but should convert to function if needed
                    sql = load_sql(
                        "app/sql/v4/simulations/get_simulation_run_context.sql"
                    )
                    run_context_for_hints = await conn.fetchrow(sql, str(chat_id_uuid))
                    hint_dept_id = (
                        run_context_for_hints.get("department_id")
                        if run_context_for_hints
                        else None
                    )
                    if hint_dept_id:
                        await internal_sio.emit(
                            "simulation_hints_generate",
                            {
                                "chat_id": str(chat_id_uuid),
                                "message_id": str(last_tool_message.get("id")),
                                "department_id": hint_dept_id,
                            },
                        )

    except OutputGuardrailTripwireTriggered as e:
        reason = ""
        try:
            reason = (
                getattr(e, "guardrail_result", None)
                and getattr(e.guardrail_result, "output", None)
                and getattr(e.guardrail_result.output, "output_info", None)
                and getattr(e.guardrail_result.output.output_info, "reason", "")
            ) or ""
        except Exception:
            reason = ""

        error_text = f"Error: {reason or 'Guardrail tripwire triggered'}"

        # Get simulation context from database if available
        attempt_id: str | None = None
        simulation_id: str | None = None
        try:
            async with get_db_connection() as conn:
                sql = load_sql("app/sql/v4/simulations/get_simulation_run_context.sql")
                context_result = await conn.fetchrow(sql, data.chat_id)
                if context_result:
                    attempt_id = (
                        str(context_result.get("attempt_id"))
                        if context_result.get("attempt_id")
                        else None
                    )
                    simulation_id = (
                        str(context_result.get("simulation_id"))
                        if context_result.get("simulation_id")
                        else None
                    )
        except Exception:
            pass  # Ignore errors when fetching context

        await internal_sio.emit(
            "simulation_text_error",
            {
                "sid": sid,
                "success": False,
                "message": error_text,
                "attempt_id": attempt_id,
                "simulation_id": simulation_id,
                "operation": "text_generation",
            },
        )

        await internal_sio.emit(
            "simulation_text_complete",
            {
                "sid": sid,
                "type": "run_complete",
                "chat_id": data.chat_id,
                "run_id": data.run_id,
            },
        )

    except Exception as e:
        # Get simulation context from database if available
        attempt_id: str | None = None
        simulation_id: str | None = None
        try:
            async with get_db_connection() as conn:
                sql = load_sql("app/sql/v4/simulations/get_simulation_run_context.sql")
                context_result = await conn.fetchrow(sql, data.chat_id)
                if context_result:
                    attempt_id = (
                        str(context_result.get("attempt_id"))
                        if context_result.get("attempt_id")
                        else None
                    )
                    simulation_id = (
                        str(context_result.get("simulation_id"))
                        if context_result.get("simulation_id")
                        else None
                    )
        except Exception:
            pass  # Ignore errors when fetching context

        await internal_sio.emit(
            "simulation_text_error",
            {
                "sid": sid,
                "success": False,
                "message": str(e),
                "attempt_id": attempt_id,
                "simulation_id": simulation_id,
                "operation": "text_generation",
            },
        )


@internal_sio.on("simulation_text_generate")  # type: ignore
async def simulation_text_generate_internal(
    data: dict[str, Any],
) -> None:
    """Handle simulation_text_generate event from internal bus (server-to-server)."""
    from app.infra.v4.websocket.handler_wrapper import handle_internal_event

    await handle_internal_event(
        data=data,
        request_type=SimulationTextGeneratePayload,
        handler=_simulation_text_generate_impl,  # type: ignore[arg-type]
        error_event_name="simulation_text_error",
        error_response_type=SimulationTextGenerateErrorPayload,
    )
