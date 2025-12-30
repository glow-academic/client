"""Handler for simulation_text_generate internal event - runs agent and emits to progress/complete."""

import asyncio
import json
import uuid
from datetime import datetime
from typing import Any

from agents import Runner, function_tool, trace
from agents.exceptions import OutputGuardrailTripwireTriggered
from agents.items import TResponseInputItem
from fastapi import APIRouter
from pydantic import BaseModel, Field, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.infra.v3.agents.generic_agent import GenericAgent
from app.infra.v3.chat.format_chat_scenario import format_chat_scenario
from app.infra.v3.debug.debug_info import DebugContext
from app.infra.v3.documents.format_document_info import format_document_info
from app.main import get_internal_sio, get_pool, get_simulation_tool_calls_dict

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


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

    items = [
        msg for msg in messages if not msg.get("content", "").startswith("Error:")
    ]

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
        elif (
            msg_type == "response" or msg_role == "assistant"
        ) and msg_content != "":
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
    """Handle simulation_text_generate internal event - runs agent and emits to progress/complete."""
    try:
        chat_id_uuid = uuid.UUID(data.chat_id)
        run_id_uuid = uuid.UUID(data.run_id)
        chat_id_str = str(chat_id_uuid)

        logger.info(
            f"Received simulation_text_generate: chat_id={data.chat_id}, run_id={data.run_id}"
        )

        pool = get_pool()
        if not pool:
            raise ValueError("Database connection pool not available")

        async with pool.acquire() as conn:
            # Get context (run already exists from member_progress)
            sql_context = load_sql(
                "app/sql/v3/simulation_text/get_text_run_context_complete.sql"
            )
            context_row = await conn.fetchrow(
                sql_context, str(chat_id_uuid), str(run_id_uuid)
            )

            if not context_row:
                raise ValueError(
                    f"Chat {chat_id_uuid} or run {run_id_uuid} not found"
                )

            # Parse JSON array for documents
            documents = (
                json.loads(context_row["documents"])
                if isinstance(context_row["documents"], str)
                else context_row["documents"]
            )

            context = {
                "chat_id": context_row["chat_id"],
                "chat_title": context_row["chat_title"],
                "trace_id": context_row["trace_id"],
                "attempt_id": context_row["attempt_id"],
                "simulation_id": context_row["simulation_id"],
                "scenario_id": context_row["scenario_id"],
                "department_id": context_row["department_id"],
                "problem_statement": context_row["problem_statement"],
                "persona_id": context_row["persona_id"],
                "persona_name": context_row["persona_name"],
                "system_prompt": context_row["system_prompt"],
                "temperature": float(context_row["temperature"])
                if context_row["temperature"] is not None
                else 0.0,
                "reasoning": context_row["reasoning"],
                "model_id": context_row["model_id"],
                "model_name": context_row["model_name"],
                "custom_model": context_row["custom_model"],
                "provider_id": context_row["provider_id"],
                "provider_name": context_row["provider_name"],
                "base_url": context_row["base_url"],
                "api_key": context_row["api_key"],
                "image_input_active": context_row["image_input_enabled"],
                "profile_id": context_row["profile_id"],
                "documents": documents,
            }

            # Validate API key
            if not context.get("api_key"):
                error_msg = (
                    f"API key not configured for provider '{context.get('provider_name', 'unknown')}' "
                    f"in settings. Model: {context.get('model_name', 'unknown')}, "
                    f"Persona: {context.get('persona_name', 'unknown')}. "
                    f"Please configure a provider key in settings."
                )
                await internal_sio.emit(
                    "simulation_text_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": error_msg,
                    },
                )
                logger.error(f"Missing API key for chat {chat_id_uuid}: {error_msg}")
                return

            # Get department_id
            department_id_str = context.get("department_id")
            if not department_id_str:
                await internal_sio.emit(
                    "simulation_text_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "No active departments found in system",
                    },
                )
                logger.error(
                    f"No active departments found in system for chat {chat_id_uuid}"
                )
                return

            department_id = uuid.UUID(str(department_id_str))

            # Build input items
            input_items: list[TResponseInputItem] = []

            # Format document info if documents are available
            if context["documents"]:
                document_info = format_document_info(
                    context["documents"], context["image_input_active"]
                )
                input_items.append(document_info)

            # Get all messages using SQL file
            sql_messages = load_sql(
                "app/sql/v3/simulations/get_simulation_messages.sql"
            )
            message_rows = await conn.fetch(sql_messages, str(chat_id_uuid))
            messages = [dict(row) for row in message_rows]

            # Prepare conversation history
            conversation_history, _ = get_simulation_conversation_history(messages)

            # Format chat scenario
            chat_scenario = format_chat_scenario(context["problem_statement"])

            input_items.insert(0, chat_scenario)
            input_items.extend(conversation_history)

            # Get simulation agent ID
            simulation_agent_id = context_row.get("agent_id")
            if not simulation_agent_id:
                raise ValueError(
                    f"Simulation Text Agent not found for simulation {context['simulation_id']}"
                )

            # Get all personas for this scenario and create persona tools
            sql_personas = load_sql("app/sql/v3/voice/get_chat_personas.sql")
            persona_rows = await conn.fetch(sql_personas, str(chat_id_uuid))
            personas = [dict(row) for row in persona_rows]

            # Track parent message for branching (latest user message)
            sql_latest_user = load_sql(
                "app/sql/v3/simulations/get_latest_user_message.sql"
            )
            latest_user_row = await conn.fetchrow(
                sql_latest_user, str(chat_id_uuid)
            )
            parent_message_id_for_branching: uuid.UUID | None = None
            if latest_user_row:
                parent_message_id_for_branching = latest_user_row["id"]

            # Track completed tool messages for hint generation
            completed_tool_messages: list[dict[str, Any]] = []

            # Create persona tools if personas exist
            persona_tools = []
            if personas:
                # Load agent tools from database
                simulation_agent_id_uuid = uuid.UUID(simulation_agent_id)
                sql_get_agent_tools = load_sql(
                    "app/sql/v3/agents/get_agent_tools.sql"
                )
                rows = await conn.fetch(
                    sql_get_agent_tools, str(simulation_agent_id_uuid)
                )
                agent_tools_config = [dict(row) for row in rows]
                tool_config_map_persona: dict[str, dict[str, Any]] = {
                    tool_config["name"]: tool_config
                    for tool_config in agent_tools_config
                }

                # Build speak tool inline
                speak_config = tool_config_map_persona.get("speak")
                if speak_config:
                    persona_desc = speak_config.get(
                        "argument_descriptions", {}
                    ).get("persona", "The name of the persona that should speak")
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
                    logger.info(
                        f"Speak tool called: persona={persona}, message_length={len(message)}"
                    )

                    persona_match = find_persona_by_name_inline(
                        persona.strip() if persona else "", personas
                    )
                    if not persona_match:
                        available_list = "\n".join(
                            f"  - {p.get('persona_name') or p.get('name', '')}"
                            for p in personas
                        )
                        error_msg = f"Persona '{persona}' not found. Available personas:\n{available_list}"
                        logger.error(error_msg)
                        return f"Error: {error_msg}"

                    persona_id, persona_display_name = persona_match
                    logger.info(
                        f"Matched persona '{persona}' to {persona_display_name} (ID: {str(persona_id)})"
                    )

                    return f"Tool call confirmed for {persona_display_name}"

                persona_tools.append(function_tool(speak))
                logger.info(
                    f"Created {len(persona_tools)} persona tools for chat {chat_id_uuid}"
                )

                # Get persona instructions for developer message
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

                persona_names = [
                    p.get("persona_name") or p.get("name", "Unknown")
                    for p in personas
                ]
                persona_descriptions = []
                for persona_name in persona_names:
                    instructions = persona_instructions_map.get(persona_name, "")
                    if instructions:
                        persona_descriptions.append(
                            f"- {persona_name}: {instructions}"
                        )
                    else:
                        persona_descriptions.append(f"- {persona_name}")

                persona_names_list = [f'"{name}"' for name in persona_names]

                developer_message_personas: TResponseInputItem = {
                    "role": "developer",
                    "content": f"""Available personas and their personalities:
{chr(10).join(persona_descriptions)}

Tool Usage Instructions:
- You MUST use the `speak` tool to respond as a persona
- The `speak` tool takes two parameters:
  * `persona`: The name of the persona that should speak (must be one of: {", ".join(persona_names_list)})
  * `message`: The message content that the persona should say
- Call exactly one tool per user message
- Never respond directly - always use the `speak` tool
- The persona name must match exactly one of the available personas listed above""",
                }
                input_items.append(developer_message_personas)

                # Add debug_info tool
                from app.infra.v3.debug.debug_info import debug_info

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
            from app.infra.v3.websocket.store_active_run import store_active_run

            await store_active_run(chat_id_str, result)

            try:
                # Process streaming events
                event_count = 0
                async for event in result.stream_events():
                    event_count += 1

                    # Check for run_item_stream_event to get tool name
                    if (
                        hasattr(event, "type")
                        and event.type == "run_item_stream_event"
                    ):
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
                    if (
                        hasattr(event, "type")
                        and event.type == "raw_response_event"
                    ):
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
                                        logger.error(
                                            "output_item.added: missing both call_id and item_id"
                                        )
                                        continue

                                    if tool_name:
                                        if fake_item_id:
                                            fake_id_to_real_id[fake_item_id] = (
                                                real_item_id
                                            )

                                        if (
                                            real_item_id
                                            in tool_calls_dict[chat_id_str]
                                        ):
                                            continue

                                        if (
                                            real_item_id
                                            in tool_calls_dict[chat_id_str]
                                        ):
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
                                                    existing_state[
                                                        "message_so_far"
                                                    ] = new_message_chars
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
                                                    "call_id": call_id or real_item_id,
                                                    "tool_name": tool_name,
                                                },
                                            )

                        # Handle response.function_call_arguments.delta
                        if (
                            event_data_type
                            == "response.function_call_arguments.delta"
                        ):
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
                                logger.warning(
                                    "Delta event has no call_id or item_id, skipping"
                                )
                                continue

                            if not delta_real_item_id:
                                logger.error(
                                    f"Failed to get real_id for fake_id={fake_item_id}, call_id={call_id}"
                                )
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

                            tool_call_state = tool_calls_dict[chat_id_str][
                                tool_call_id
                            ]

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
                                tool_call_state["message_so_far"] += (
                                    new_message_chars
                                )

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
                    if (
                        hasattr(event, "type")
                        and event.type == "raw_response_event"
                    ):
                        event_data = getattr(event, "data", None)
                        if event_data:
                            event_data_type = (
                                getattr(event_data, "type", None)
                                if hasattr(event_data, "type")
                                else None
                            )
                            if event_data_type == "response.output_item.done":
                                fake_item_id = getattr(
                                    event_data, "item_id", None
                                )
                                item = getattr(event_data, "item", None)
                                call_id = None
                                if item:
                                    call_id = getattr(item, "call_id", None)
                                if not call_id:
                                    call_id = getattr(
                                        event_data, "call_id", None
                                    )

                                if call_id:
                                    done_real_item_id = call_id
                                elif fake_item_id:
                                    done_real_item_id = fake_id_to_real_id.get(
                                        fake_item_id
                                    )
                                else:
                                    logger.warning(
                                        "Completion event has no call_id or item_id"
                                    )
                                    continue

                                if not done_real_item_id:
                                    logger.warning(
                                        f"Completion event for unknown fake_id={fake_item_id}, call_id={call_id}"
                                    )
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

                                    # Parse final JSON arguments
                                    try:
                                        final_args = json.loads(
                                            tool_call_state["arguments_raw"]
                                        )
                                        final_message = final_args.get(
                                            "message",
                                            tool_call_state["message_so_far"],
                                        )
                                        final_persona = final_args.get(
                                            "persona",
                                            tool_call_state["persona_so_far"],
                                        )

                                        tool_call_state["message_so_far"] = (
                                            final_message
                                        )
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
                                                "id": tool_call_state.get(
                                                    "db_message_id"
                                                ),
                                                "content": final_message,
                                            }
                                        )

                                        del tool_calls_dict[chat_id_str][
                                            tool_call_id
                                        ]

                                    except json.JSONDecodeError as e:
                                        logger.error(
                                            f"Failed to parse final tool call arguments: {e}"
                                        )
                                        final_message = tool_call_state[
                                            "message_so_far"
                                        ]
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
                                                "final_persona": tool_call_state[
                                                    "persona_so_far"
                                                ],
                                                "arguments_raw": tool_call_state[
                                                    "arguments_raw"
                                                ],
                                            },
                                        )
                                        del tool_calls_dict[chat_id_str][
                                            tool_call_id
                                        ]

            except BaseException as stream_error:
                if isinstance(
                    stream_error,
                    (asyncio.CancelledError, KeyboardInterrupt, SystemExit),
                ):
                    raise
                logger.error(
                    f"Error processing stream: {stream_error}", exc_info=True
                )
                raise
            except Exception as stream_error:
                logger.error(
                    f"Error processing stream: {stream_error}", exc_info=True
                )
                raise
            finally:
                # Complete any remaining tool calls
                if (
                    chat_id_str in tool_calls_dict
                    and tool_calls_dict[chat_id_str]
                ):
                    pool = get_pool()
                    if pool:
                        try:
                            async with pool.acquire() as cleanup_conn:
                                for tool_call_id, tool_call_state in list(
                                    tool_calls_dict[chat_id_str].items()
                                ):
                                    try:
                                        db_message_id = tool_call_state.get(
                                            "db_message_id"
                                        )
                                        if (
                                            db_message_id
                                            and tool_call_state.get(
                                                "message_so_far"
                                            )
                                        ):
                                            final_message = tool_call_state[
                                                "message_so_far"
                                            ]

                                            try:
                                                if tool_call_state.get(
                                                    "arguments_raw"
                                                ):
                                                    final_args = json.loads(
                                                        tool_call_state[
                                                            "arguments_raw"
                                                        ]
                                                    )
                                                    final_message = final_args.get(
                                                        "message", final_message
                                                    )
                                            except json.JSONDecodeError:
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
                                    except Exception as e:
                                        logger.error(
                                            f"Error completing tool call {tool_call_id}: {e}",
                                            exc_info=True,
                                        )

                # Clean up tool call states
                if chat_id_str in tool_calls_dict:
                    del tool_calls_dict[chat_id_str]

                # Clean up active run
                from app.infra.v3.websocket.remove_active_run import (
                    remove_active_run,
                )

                await remove_active_run(chat_id_str)

            # Emit async pricing event
            usage = result.context_wrapper.usage
            await internal_sio.emit(
                "log_run",
                {
                    "runId": str(run_id_uuid),
                    "operationType": "simulation",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": context["system_prompt"],
                    "inputItems": input_items,
                    "assistantOutput": None,
                    "departmentId": str(context.get("department_id")),
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

                sql = load_sql(
                    "app/sql/v3/simulations/get_simulation_metadata_for_chat.sql"
                )
                sim_metadata_row = await conn.fetchrow(sql, str(chat_id_uuid))
                if not sim_metadata_row:
                    logger.warning(
                        f"Failed to get simulation metadata for chat {chat_id_uuid}"
                    )
                    sim_metadata = {"practice_simulation": False}
                else:
                    sim_metadata = {
                        "simulation_id": sim_metadata_row["simulation_id"],
                        "attempt_id": sim_metadata_row["attempt_id"],
                        "practice_simulation": sim_metadata_row[
                            "practice_simulation"
                        ],
                    }

                if sim_metadata["practice_simulation"]:
                    logger.info(
                        f"Triggering hint generation for practice message {last_tool_message.get('id')}"
                    )
                    sql = load_sql(
                        "app/sql/v3/simulations/get_simulation_run_context.sql"
                    )
                    run_context_for_hints = await conn.fetchrow(
                        sql, str(chat_id_uuid)
                    )
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
                    and getattr(
                        e.guardrail_result.output, "output_info", None
                    )
                    and getattr(
                        e.guardrail_result.output.output_info, "reason", ""
                    )
                ) or ""
            except Exception:
                reason = ""

            error_text = f"Error: {reason or 'Guardrail tripwire triggered'}"

            await internal_sio.emit(
                "simulation_text_error",
                {
                    "sid": sid,
                    "success": False,
                    "message": error_text,
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
        logger.error(
            f"Error in simulation_text_generate for {sid}: {str(e)}", exc_info=True
        )
        await internal_sio.emit(
            "simulation_text_error",
            {
                "sid": sid,
                "success": False,
                "message": str(e),
            },
        )


@internal_sio.on("simulation_text_generate")  # type: ignore
async def simulation_text_generate_internal(
    data: dict[str, Any],
) -> None:
    """Handle simulation_text_generate event from internal bus (server-to-server)."""
    from app.infra.v3.websocket.handler_wrapper import handle_internal_event

    await handle_internal_event(
        data=data,
        request_type=SimulationTextGeneratePayload,
        handler=_simulation_text_generate_impl,  # type: ignore[arg-type]
        error_event_name="simulation_text_error",
        error_response_type=SimulationTextGenerateErrorPayload,
    )

