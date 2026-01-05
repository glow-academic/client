"""Handler for prompt_generate WebSocket event - generates prompts and instructions."""

import asyncio
import json
import uuid
from typing import Any, cast

from agents import Runner, function_tool, trace
from agents.items import TResponseInputItem
from fastapi import APIRouter
from pydantic import BaseModel, Field, ValidationError
from utils.sql_helper import execute_sql_typed

from app.infra.v4.agents.generic_agent import GenericAgent
from app.infra.v4.chat.format_chat_scenario import format_chat_scenario
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.remove_active_run import remove_active_run
from app.infra.v4.websocket.store_active_run import store_active_run
from app.main import get_internal_sio, sio

# Types will be auto-generated from SQL introspection
try:
    from app.sql.types import (
        GetPromptRunContextAndCreateRunSqlParams,
        GetPromptRunContextAndCreateRunSqlRow,
        GetSimulationMessagesSqlParams,
        GetSimulationMessagesSqlRow,
    )
except ImportError:
    from pydantic import BaseModel

    class GetPromptRunContextAndCreateRunSqlParams(BaseModel):
        chat_id: uuid.UUID
        profile_id: uuid.UUID
        group_id: uuid.UUID | None = None

    class GetPromptRunContextAndCreateRunSqlRow(BaseModel):
        chat_id: str
        chat_title: str
        trace_id: str
        attempt_id: str
        simulation_id: str
        scenario_id: str
        department_id: str
        system_prompt: str
        temperature: float
        reasoning: str
        model_id: str
        model_name: str
        provider: str
        base_url: str
        api_key: str
        custom_model: str | None
        provider_id: str | None
        provider_name: str
        agent_id: str
        profile_id: str
        req_per_day: int
        runs_today_count: int
        earliest_run_created_at: str | None
        run_id: str
        group_id: uuid.UUID

    class GetSimulationMessagesSqlParams(BaseModel):
        chat_id: uuid.UUID

    class GetSimulationMessagesSqlRow(BaseModel):
        messages: list[Any] | None = None


internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_CONTEXT = (
    "app/sql/v4/prompt/get_prompt_run_context_and_create_run_complete.sql"
)
SQL_PATH_MESSAGES = "app/sql/v4/simulations/get_simulation_messages_complete.sql"


# Helper functions for extracting arguments from JSON
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
    prev_json: str, new_json: str, last_index: int, field_name: str = "content"
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

    new_chars = ""
    i = start_extracting_from
    in_escape = False

    while i < len(new_json):
        char = new_json[i]
        if in_escape:
            new_chars += char
            in_escape = False
            i += 1
            continue

        if char == "\\":
            in_escape = True
            new_chars += char
            i += 1
            continue

        if char == '"':
            break

        new_chars += char
        i += 1

    return new_chars, i, True


# Pydantic models
class PromptGeneratePayload(BaseModel):
    """Request to generate prompt agent response."""

    chat_id: str
    group_id: str | None = None


class PromptGenerateErrorPayload(BaseModel):
    """Response indicating an error occurred in prompt generation."""

    success: bool
    message: str


# Emit helper functions
async def prompt_generate_error(payload: PromptGenerateErrorPayload, room: str) -> None:
    await sio.emit("prompt_generate_error", payload.model_dump(), room=room)


async def _prompt_generate_impl(
    sid: str,
    data: PromptGeneratePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle prompt_generate internal event - runs agent and emits to progress/complete."""
    try:
        chat_id_uuid = uuid.UUID(data.chat_id)
        chat_id_str = str(chat_id_uuid)

        async with get_db_connection() as conn:
            # Get all context data AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            try:
                params = GetPromptRunContextAndCreateRunSqlParams(
                    chat_id=chat_id_uuid,
                    profile_id=profile_id,
                    group_id=group_id,
                )
                result = cast(
                    GetPromptRunContextAndCreateRunSqlRow,
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
                        "prompt_generate_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": user_msg,
                        },
                    )
                    return
                raise

            model_run_id = uuid.UUID(result.run_id)
            group_id_uuid = result.group_id

            # Store active run for cancellation support
            await store_active_run(chat_id_str, model_run_id)

            # Get conversation history
            messages_params = GetSimulationMessagesSqlParams(chat_id=chat_id_uuid)
            messages_result = cast(
                GetSimulationMessagesSqlRow,
                await execute_sql_typed(
                    conn, SQL_PATH_MESSAGES, params=messages_params
                ),
            )
            conversation_history = (
                messages_result.messages if messages_result.messages else []
            )

            # Format chat scenario for context
            scenario_text = format_chat_scenario(result.scenario_id)

            # Build input items for agent
            input_items: list[TResponseInputItem] = []

            # Add system prompt
            system_prompt = str(result.system_prompt) if result.system_prompt else ""
            if system_prompt:
                input_items.append({"role": "system", "content": system_prompt})

            # Add scenario context
            if scenario_text:
                input_items.append({"role": "user", "content": scenario_text})

            # Add conversation history
            for msg in conversation_history:
                input_items.append(msg)

            # Load agent tools from database
            agent_id_uuid = uuid.UUID(result.agent_id)
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

            # Build prompt agent tools with function_tool wrappers
            prompt_tools: list[Any] = []

            # Create instruct tool wrapper
            instruct_config = tool_config_map.get("instruct")
            if instruct_config:
                content_desc = instruct_config.get("argument_descriptions", {}).get(
                    "content", "Developer instruction content"
                )
            else:
                content_desc = "Developer instruction content"

            async def instruct(content: str = Field(description=content_desc)) -> str:
                """Provide developer instructions."""
                return "Tool call confirmed for instruct"

            if "instruct" in tool_config_map:
                prompt_tools.append(function_tool(instruct))

            # Create prompt tool wrapper
            prompt_config = tool_config_map.get("prompt")
            if prompt_config:
                prompt_content_desc = prompt_config.get(
                    "argument_descriptions", {}
                ).get("content", "System prompt content")
            else:
                prompt_content_desc = "System prompt content"

            async def prompt(
                content: str = Field(description=prompt_content_desc),
            ) -> str:
                """Set system prompt."""
                return "Tool call confirmed for prompt"

            if "prompt" in tool_config_map:
                prompt_tools.append(function_tool(prompt))

            # Add debug_info tool if available
            if "debug_info" in tool_config_map:
                from app.infra.v4.debug.debug_info import debug_info

                prompt_tools.append(debug_info)

            # Create agent instance with loaded tools
            agent_name = "Prompt Agent"
            system_prompt = str(result.system_prompt) if result.system_prompt else ""
            temperature = (
                float(result.temperature) if result.temperature is not None else 0.0
            )
            model_name = str(result.model_name) if result.model_name else ""
            provider = str(result.provider) if result.provider else ""
            base_url = str(result.base_url) if result.base_url else None
            reasoning = str(result.reasoning) if result.reasoning else None
            api_key = str(result.api_key) if result.api_key else ""

            agent = GenericAgent(
                agent_name=agent_name,
                system_prompt=system_prompt,
                temperature=temperature,
                model_name=model_name,
                provider=provider,
                base_url=base_url,
                reasoning=reasoning,
                api_key=api_key,
                tools=prompt_tools,
                tool_use_behavior="required",  # Prompt agent must use tools
            )

            # Get trace_id from group
            trace_id_str = str(result.trace_id) if result.trace_id else None

            # Run agent with streaming
            with trace(
                trace_id=trace_id_str,
                group_id=str(group_id_uuid) if group_id_uuid else None,
            ):
                result_runner = Runner.run_streamed(agent, input_items)

            # Track tool calls for progress events
            tool_calls_dict: dict[str, dict[str, Any]] = {}
            fake_id_to_real_id: dict[str, str] = {}
            tool_call_counter = 0
            parent_message_id_for_branching: uuid.UUID | None = None

            try:
                async for event in result_runner.stream_events():
                    # Handle tool call events
                    if hasattr(event, "type") and event.type == "raw_response_event":
                        event_data = getattr(event, "data", None)
                        if event_data:
                            event_data_type = (
                                getattr(event_data, "type", None)
                                if hasattr(event_data, "type")
                                else None
                            )

                            # Handle response.function_call_arguments.start
                            if (
                                event_data_type
                                == "response.function_call_arguments.start"
                            ):
                                fake_item_id = getattr(event_data, "item_id", None)
                                item = getattr(event_data, "item", None)
                                call_id = None
                                tool_name = None
                                if item:
                                    call_id = getattr(item, "call_id", None)
                                    tool_name = getattr(item, "name", None)

                                if not call_id:
                                    call_id = getattr(event_data, "call_id", None)
                                if not tool_name:
                                    tool_name = getattr(event_data, "item_id", None)

                                if call_id:
                                    real_item_id = call_id
                                elif fake_item_id:
                                    tool_call_counter += 1
                                    real_item_id = f"{chat_id_str}_{tool_call_counter}_{uuid.uuid4().hex[:8]}"
                                else:
                                    continue

                                if tool_name:
                                    if fake_item_id:
                                        fake_id_to_real_id[fake_item_id] = real_item_id

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
                                            "prompt_progress",
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

                                # Extract content based on tool type (prompt agent tools use "content")
                                field_name = "content"
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

                                    # Emit progress event
                                    await internal_sio.emit(
                                        "prompt_progress",
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
                                                tool_name in ("instruct", "prompt")
                                                and "content" in final_args
                                            ):
                                                final_content = final_args["content"]
                                        except json.JSONDecodeError:
                                            pass

                                    tool_call_state["content_so_far"] = final_content

                                    # Emit generic tool_call_complete event
                                    await internal_sio.emit(
                                        "prompt_complete",
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
                str(result.department_id)
                if hasattr(result, "department_id") and result.department_id
                else ""
            )
            await internal_sio.emit(
                "log_run",
                {
                    "runId": str(model_run_id),
                    "operationType": "prompt",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": system_prompt,
                    "inputItems": input_items,
                    "assistantOutput": None,  # Tool calls handle their own output
                    "departmentId": department_id_str,
                },
            )

            # Emit run completion event (dispatched by complete.py)
            await internal_sio.emit(
                "prompt_complete",
                {
                    "sid": sid,
                    "type": "run_complete",
                    "chat_id": chat_id_str,
                    "run_id": str(model_run_id),
                },
            )

    except ValueError as e:
        await internal_sio.emit(
            "prompt_generate_error",
            {
                "sid": sid,
                "success": False,
                "message": f"Invalid UUID format: {str(e)}",
            },
        )
    except Exception as e:
        await internal_sio.emit(
            "prompt_generate_error",
            {
                "sid": sid,
                "success": False,
                "message": str(e),
            },
        )


@sio.event  # type: ignore
async def prompt_generate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler."""

    profile_id = await find_profile_by_socket(sid)
    if not profile_id:
        await prompt_generate_error(
            PromptGenerateErrorPayload(
                success=False, message="Profile not found for socket"
            ),
            room=sid,
        )
        return

    try:
        validated = PromptGeneratePayload(**data)
    except ValidationError as e:
        await prompt_generate_error(
            PromptGenerateErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )
        return

    group_id = uuid.UUID(validated.group_id) if validated.group_id else None

    await _prompt_generate_impl(sid, validated, profile_id, group_id)


@internal_sio.on("prompt_generate")  # type: ignore
async def prompt_generate_internal(data: dict[str, Any]) -> None:
    """Handle prompt_generate event from internal bus (server-to-server)."""
    from app.infra.v4.websocket.handler_wrapper import handle_internal_event

    await handle_internal_event(
        data=data,
        request_type=PromptGeneratePayload,
        handler=_prompt_generate_impl,  # type: ignore[arg-type]
        error_event_name="prompt_generate_error",
        error_response_type=PromptGenerateErrorPayload,
    )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/generate", response_model=dict[str, bool])
async def prompt_generate_api(request: PromptGeneratePayload) -> dict[str, bool]:
    """Client-to-server event: Generate prompt agent response."""
    return {"success": True}


@server_router.post("/generate_error", response_model=dict[str, bool])
async def prompt_generate_error_api(
    request: PromptGenerateErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred in prompt generation."""
    return {"success": True}


from app.infra.v4.websocket.openapi_helpers import register_server_endpoint

register_server_endpoint(
    client_router,
    "/generate",
    PromptGeneratePayload,
    "Generate prompt agent response",
)
