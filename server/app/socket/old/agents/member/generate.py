"""Handler for member_generate WebSocket event - generates student responses."""

import asyncio
import json
import uuid
from typing import Any, cast

from agents import Runner, function_tool, trace
from agents.items import TResponseInputItem
from fastapi import APIRouter
from jinja2 import Template
from pydantic import BaseModel, Field, ValidationError
from utils.sql_helper import execute_sql_typed

from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.chat.format_chat_scenario import format_chat_scenario
from app.infra.v4.debug.debug_info import DebugContext
from app.infra.v4.documents.format_document_info import format_document_info
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.remove_active_run import remove_active_run
from app.infra.v4.websocket.store_active_run import store_active_run
from app.main import get_internal_sio, sio
from app.socket.old.agents.simulation.generate import (
    get_simulation_conversation_history,
)
from app.sql.types import (
    GetDeveloperInstructionSqlParams,
    GetDeveloperInstructionSqlRow,
    GetMemberRunContextAndCreateRunSqlParams,
    GetMemberRunContextAndCreateRunSqlRow,
    GetSimulationMessagesSqlParams,
    GetSimulationMessagesSqlRow,
    LinkDeveloperMessageToRunSqlParams,
)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_CONTEXT = (
    "app/sql/v4/member/get_member_run_context_and_create_run_complete.sql"
)
SQL_PATH_MESSAGES = "app/sql/v4/simulations/get_simulation_messages_complete.sql"


# Helper functions for extracting arguments from JSON
def extract_message_from_json(json_str: str) -> str | None:
    """Extract message field from partial JSON string."""
    import re

    match = re.search(r'"message"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', json_str)
    if match:
        message_str = match.group(1)
        try:
            return message_str.encode("utf-8").decode("unicode_escape")
        except Exception:
            return message_str
    return None


def extract_content_from_json(json_str: str) -> str | None:
    """Extract content field from partial JSON string."""
    import re

    match = re.search(r'"content"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', json_str)
    if match:
        content_str = match.group(1)
        try:
            return content_str.encode("utf-8").decode("unicode_escape")
        except Exception:
            return content_str
    return None


def extract_new_chars(
    prev_json: str, new_json: str, last_index: int, field_name: str = "message"
) -> tuple[str, int, bool]:
    """Extract new characters from JSON string incrementally for a given field."""
    if len(new_json) <= last_index:
        return "", last_index, False

    field_pattern = f'"{field_name}"'
    field_start_idx = new_json.find(field_pattern, 0)
    if field_start_idx == -1:
        return "", last_index, False

    colon_idx = new_json.find(":", field_start_idx)
    if colon_idx == -1:
        return "", last_index, False

    quote_idx = new_json.find('"', colon_idx)
    if quote_idx == -1:
        return "", last_index, False

    field_value_start = quote_idx + 1

    if last_index < field_value_start:
        if len(new_json) > field_value_start:
            start_extracting_from = field_value_start
        elif len(new_json) == field_value_start:
            return "", field_value_start, False
        else:
            return "", last_index, False
    else:
        start_extracting_from = last_index

    new_chars = []
    i = start_extracting_from
    in_field = True
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

    new_content = "".join(new_chars)
    return new_content, i, in_field


# Pydantic models
class MemberGeneratePayload(BaseModel):
    """Request to generate member agent response."""

    chat_id: str
    group_id: str | None = None


class MemberGenerateErrorPayload(BaseModel):
    """Response indicating an error occurred in member generation."""

    success: bool
    message: str


# Emit helper functions
async def member_generate_error(payload: MemberGenerateErrorPayload, room: str) -> None:
    await sio.emit("member_generate_error", payload.model_dump(), room=room)


async def _member_generate_impl(
    sid: str,
    data: MemberGeneratePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle member_generate internal event - runs agent and emits to progress/complete."""
    try:
        chat_id_uuid = uuid.UUID(data.chat_id)
        chat_id_str = str(chat_id_uuid)

        async with get_db_connection() as conn:
            # Get all context data AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            try:
                params = GetMemberRunContextAndCreateRunSqlParams(
                    chat_id=chat_id_uuid,
                    profile_id=profile_id,
                    group_id=group_id,
                )
                context_result = cast(
                    GetMemberRunContextAndCreateRunSqlRow,
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
                        "member_generate_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": user_msg,
                        },
                    )
                    return
                await internal_sio.emit(
                    "member_generate_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"Failed to initialize member generation: {str(e)}",
                    },
                )
                return

            if not context_result:
                await internal_sio.emit(
                    "member_generate_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": f"No member agent configured for chat {data.chat_id}",
                    },
                )
                return

            # Get department_id
            department_id_str = context_result.department_id
            if not department_id_str:
                await internal_sio.emit(
                    "member_generate_error",
                    {
                        "sid": sid,
                        "success": False,
                        "message": "No active departments found in system",
                    },
                )
                return

            department_id = uuid.UUID(str(department_id_str))

            # Extract run_id from context (created in same transaction)
            model_run_id = uuid.UUID(context_result.run_id)

            # Build input items
            input_items: list[TResponseInputItem] = []

            # Format document info if documents are available
            documents = context_result.documents or []
            if documents:
                # Convert composite type documents to dict format for format_document_info
                documents_dict = [
                    {
                        "id": str(doc.id) if doc.id else "",
                        "name": str(doc.name) if doc.name else "",
                        "file_path": str(doc.file_path) if doc.file_path else "",
                        "mime_type": str(doc.mime_type) if doc.mime_type else "",
                    }
                    for doc in documents
                ]
                image_input_enabled = (
                    bool(context_result.image_input_enabled)
                    if context_result.image_input_enabled is not None
                    else False
                )
                document_info = format_document_info(
                    documents_dict, image_input_enabled
                )
                input_items.append(document_info)

            # Get all messages using execute_sql_typed
            messages_params = GetSimulationMessagesSqlParams(chat_id=chat_id_uuid)
            messages_context_result = cast(
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
                for msg in (messages_context_result.messages or [])
            ]

            # Prepare conversation history
            conversation_history, _ = get_simulation_conversation_history(messages)

            # Format chat scenario
            problem_statement = (
                str(context_result.problem_statement)
                if context_result.problem_statement
                else ""
            )
            chat_scenario = format_chat_scenario(problem_statement)

            input_items.insert(0, chat_scenario)
            input_items.extend(conversation_history)

            # Get developer instruction template from database (if configured)
            try:
                dev_instruction_params = GetDeveloperInstructionSqlParams(
                    instruction_type="member",
                    agent_role_val="member",
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
                    # Render Jinja template (no context variables needed for member)
                    template = Template(dev_instruction_result.template)
                    developer_message_content = template.render()
                    if developer_message_content:
                        developer_message: TResponseInputItem = {
                            "role": "developer",
                            "content": developer_message_content,
                        }
                        input_items.append(developer_message)

                        # Link developer message to run
                        try:
                            link_params = LinkDeveloperMessageToRunSqlParams(
                                content=developer_message_content,
                                run_id=model_run_id,
                            )
                            await execute_sql_typed(
                                conn,
                                "app/sql/v4/simulations/link_developer_message_to_run_complete.sql",
                                params=link_params,
                            )
                        except Exception:
                            # Log error but continue - message is already in input_items
                            pass
            except Exception:
                # No developer instruction configured - continue without it
                pass

            # Get member agent ID
            member_agent_id = context_result.agent_id
            if not member_agent_id:
                raise ValueError(
                    f"Member Agent not found for chat {context_result.chat_id}"
                )

            # Load agent tools from database
            # Ensure member_agent_id is a string before converting to UUID
            agent_id_uuid = uuid.UUID(str(member_agent_id))
            from app.sql.types import GetAgentToolsSqlRow

            # Function returns multiple rows, so we call it directly with fetch()
            function_call_sql = 'SELECT * FROM "public"."socket_get_agent_tools_v4"($1)'
            rows = await conn.fetch(function_call_sql, agent_id_uuid)
            agent_tools_config = [
                GetAgentToolsSqlRow.model_validate(dict(row)).model_dump()
                for row in rows
            ]
            tool_config_map: dict[str, dict[str, Any]] = {
                tool_config["name"]: tool_config for tool_config in agent_tools_config
            }

            # Build member agent tools with function_tool wrappers
            member_tools: list[Any] = []

            # Create speak tool wrapper
            speak_config = tool_config_map.get("create_content")
            if speak_config:
                message_desc = speak_config.get("argument_descriptions", {}).get(
                    "message", "The message content to speak"
                )
            else:
                message_desc = "The message content to speak"

            async def speak(message: str = Field(description=message_desc)) -> str:
                """Make a message speak (for user or assistant messages)."""
                return "Tool call confirmed for speak"

            if "create_content" in tool_config_map:
                member_tools.append(function_tool(speak))

            # Add debug_info tool if available
            if "debug_info" in tool_config_map:
                from app.infra.v4.debug.debug_info import debug_info

                member_tools.append(debug_info)

            # Create agent instance with loaded tools
            persona_name = (
                str(context_result.persona_name)
                if context_result.persona_name
                else "Member Agent"
            )
            system_prompt = (
                str(context_result.system_prompt)
                if context_result.system_prompt
                else ""
            )
            temperature = (
                float(context_result.temperature)
                if context_result.temperature is not None
                else 0.0
            )
            model_name = (
                str(context_result.model_name) if context_result.model_name else ""
            )
            provider_name = (
                str(context_result.provider_name)
                if context_result.provider_name
                else ""
            )
            base_url = str(context_result.base_url) if context_result.base_url else None
            reasoning = (
                str(context_result.reasoning) if context_result.reasoning else None
            )
            api_key = str(context_result.api_key) if context_result.api_key else ""

            member_agent = GenericAgent(
                agent_name=persona_name,
                system_prompt=system_prompt,
                temperature=temperature,
                model_name=model_name,
                provider=provider_name,
                base_url=base_url,
                reasoning=reasoning,
                api_key=api_key,
                tools=member_tools,
            )

            agent_instance = member_agent.agent()

            # Track tool calls for this chat
            tool_calls_dict: dict[str, dict[str, Any]] = {}
            fake_id_to_real_id: dict[str, str] = {}
            tool_call_counter = 0

            # Find latest user message for branching
            parent_message_id_for_branching: uuid.UUID | None = None
            for msg in reversed(messages):
                if msg.get("role") == "user":
                    parent_message_id_for_branching = uuid.UUID(msg["id"])
                    break

            # Run agent with streaming
            chat_title = (
                str(context_result.chat_title) if context_result.chat_title else ""
            )
            trace_id = str(context_result.trace_id) if context_result.trace_id else None
            attempt_id = (
                str(context_result.attempt_id) if context_result.attempt_id else None
            )

            with trace(
                chat_title,
                trace_id=trace_id,
                group_id=attempt_id,
            ):
                result_runner = Runner.run_streamed(
                    agent_instance,
                    input=input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            # Store the result in active runs for potential cancellation
            await store_active_run(chat_id_str, result_runner)

            try:
                # Process streaming events
                async for event in result_runner.stream_events():
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

                                        if real_item_id not in tool_calls_dict:
                                            tool_calls_dict[real_item_id] = {
                                                "name": tool_name,
                                                "response_id": real_item_id,
                                                "call_id": call_id,
                                                "fake_id": fake_item_id,
                                                "arguments_raw": "",
                                                "content_so_far": "",
                                                "db_message_id": None,
                                                "db_tool_call_id": None,
                                                "last_processed_index": 0,
                                                "parent_message_id": parent_message_id_for_branching,
                                                "completed": False,
                                            }

                                            # Emit generic tool_call_start event
                                            await internal_sio.emit(
                                                "member_progress",
                                                {
                                                    "sid": sid,
                                                    "type": "tool_call_start",
                                                    "chat_id": chat_id_str,
                                                    "run_id": str(model_run_id),
                                                    "tool_name": tool_name,
                                                    "tool_call_id": real_item_id,
                                                    "call_id": call_id or real_item_id,
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

                            if tool_call_id not in tool_calls_dict:
                                tool_calls_dict[tool_call_id] = {
                                    "name": None,
                                    "response_id": str(tool_call_id),
                                    "call_id": call_id,
                                    "arguments_raw": "",
                                    "content_so_far": "",
                                    "db_message_id": None,
                                    "db_tool_call_id": None,
                                    "last_processed_index": 0,
                                    "parent_message_id": parent_message_id_for_branching,
                                    "completed": False,
                                }

                            tool_call_state = tool_calls_dict[tool_call_id]

                            if tool_call_state["name"] is None:
                                tool_call_state["arguments_raw"] += arguments_delta
                                continue

                            tool_name = tool_call_state["name"]
                            prev_raw = tool_call_state["arguments_raw"]
                            tool_call_state["arguments_raw"] += arguments_delta
                            new_raw = tool_call_state["arguments_raw"]

                            # Extract content based on tool type
                            field_name = (
                                "message" if tool_name == "create_content" else "content"
                            )
                            (
                                new_chars,
                                new_index,
                                in_field,
                            ) = extract_new_chars(
                                prev_raw,
                                new_raw,
                                tool_call_state["last_processed_index"],
                                field_name,
                            )
                            tool_call_state["last_processed_index"] = new_index

                            if new_chars:
                                tool_call_state["content_so_far"] += new_chars

                                # Emit progress event (this IS the progress, not a separate handler)
                                await internal_sio.emit(
                                    "member_progress",
                                    {
                                        "sid": sid,
                                        "type": "tool_call_progress",
                                        "chat_id": chat_id_str,
                                        "run_id": str(model_run_id),
                                        "tool_name": tool_name,
                                        "tool_call_id": tool_call_id,
                                        "call_id": call_id or tool_call_id,
                                        "token": new_chars,
                                        "accumulated_content": tool_call_state[
                                            "content_so_far"
                                        ],
                                        "arguments_raw": new_raw,
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

                                if done_real_item_id in tool_calls_dict:
                                    tool_call_id = done_real_item_id
                                    tool_call_state = tool_calls_dict[tool_call_id]

                                    if tool_call_state.get("completed"):
                                        continue

                                    tool_call_state["completed"] = True
                                    tool_name = tool_call_state["name"]

                                    # Extract final content from JSON
                                    final_content = tool_call_state["content_so_far"]
                                    if tool_call_state["arguments_raw"]:
                                        try:
                                            final_args = json.loads(
                                                tool_call_state["arguments_raw"]
                                            )
                                            if (
                                                tool_name == "create_content"
                                                and "message" in final_args
                                            ):
                                                final_content = final_args["message"]
                                        except json.JSONDecodeError:
                                            pass

                                    tool_call_state["content_so_far"] = final_content

                                    # Emit generic tool_call_complete event
                                    await internal_sio.emit(
                                        "member_complete",
                                        {
                                            "sid": sid,
                                            "type": "tool_call_complete",
                                            "chat_id": chat_id_str,
                                            "run_id": str(model_run_id),
                                            "tool_name": tool_name,
                                            "tool_call_id": tool_call_id,
                                            "call_id": call_id or tool_call_id,
                                            "final_content": final_content,
                                            "arguments_raw": tool_call_state[
                                                "arguments_raw"
                                            ],
                                        },
                                    )

                                    del tool_calls_dict[tool_call_id]

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
                # Clean up active run
                await remove_active_run(chat_id_str)

            # Emit async pricing event
            usage = result_runner.context_wrapper.usage
            department_id_str = (
                str(context_result.department_id)
                if context_result.department_id
                else ""
            )
            await internal_sio.emit(
                "log_run",
                {
                    "run_id": str(model_run_id),
                    "operation_type": "member",
                    "input_text_tokens": usage.input_tokens,
                    "output_text_tokens": usage.output_tokens,
                    "system_prompt": system_prompt,
                    "input_items": input_items,
                    "assistant_output": None,  # Tool calls handle their own output
                    "department_id": department_id_str if department_id_str else None,
                },
            )

            # Emit run completion event (dispatched by complete.py)
            await internal_sio.emit(
                "member_complete",
                {
                    "sid": sid,
                    "type": "run_complete",
                    "chat_id": chat_id_str,
                    "run_id": str(model_run_id),
                },
            )

    except Exception as e:
        await internal_sio.emit(
            "member_generate_error",
            {
                "sid": sid,
                "success": False,
                "message": str(e),
            },
        )


@sio.event  # type: ignore
async def member_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle member_generate event from client (client-to-server)."""
    try:
        validated = MemberGeneratePayload(**data)
    except ValidationError as e:
        await member_generate_error(
            MemberGenerateErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
        return

    # Get profile_id from sid lookup (O(1) Redis lookup)
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        await member_generate_error(
            MemberGenerateErrorPayload(
                success=False, message="Profile not found. Please reconnect."
            ),
            room=sid,
        )
        return
    profile_id = uuid.UUID(profile_id_str)

    group_id = None
    if validated.group_id:
        try:
            group_id = uuid.UUID(validated.group_id)
        except ValueError:
            pass

    await _member_generate_impl(sid, validated, profile_id, group_id)


@internal_sio.on("member_generate")  # type: ignore
async def member_generate_internal(data: dict[str, Any]) -> None:
    """Handle member_generate event from internal bus (server-to-server)."""
    from app.infra.v4.websocket.handler_wrapper import handle_internal_event

    await handle_internal_event(
        data=data,
        request_type=MemberGeneratePayload,
        handler=_member_generate_impl,  # type: ignore[arg-type]
        error_event_name="member_generate_error",
        error_response_type=MemberGenerateErrorPayload,
    )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/generate", response_model=dict[str, bool])
async def member_generate_api(request: MemberGeneratePayload) -> dict[str, bool]:
    """Client-to-server event: Generate member agent response."""
    return {"success": True}


@server_router.post("/generate_error", response_model=dict[str, bool])
async def member_generate_error_api(
    request: MemberGenerateErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred in member generation."""
    return {"success": True}
