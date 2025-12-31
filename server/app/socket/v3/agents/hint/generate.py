"""Handler for simulation_hints_generate WebSocket event."""

import uuid
from typing import Any, cast

from agents import Runner, Tool, function_tool, trace
from agents.items import TResponseInputItem
from fastapi import APIRouter
from pydantic import BaseModel, Field
from utils.sql_helper import execute_sql_typed

from app.infra.v3.agents.utils.build_hint_agent import build_hint_agent
from app.infra.v3.chat.format_chat_scenario import format_chat_scenario
from app.infra.v3.debug.debug_info import DebugContext
from app.infra.v3.documents.format_document_info import format_document_info
from app.infra.v3.websocket.get_db_connection import get_db_connection
from app.infra.v3.websocket.handler_wrapper import handle_client_event
from app.infra.v3.websocket.openapi_helpers import register_client_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.sql.types import (
    CreateHintsSqlParams,
    CreateHintsSqlRow,
    GetHintRunContextAndCreateRunApiRequest,
    GetHintRunContextAndCreateRunSqlParams,
    GetHintRunContextAndCreateRunSqlRow,
    GetSimulationMessagesSqlParams,
    GetSimulationMessagesSqlRow,
    HintGenerationErrorSqlRow,
)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH_GENERATE = "app/sql/v3/simulations/generate_hints_complete.sql"
SQL_PATH_MESSAGES = "app/sql/v3/simulations/get_simulation_messages_complete.sql"
SQL_PATH_CREATE_HINTS = "app/sql/v3/simulations/create_hints_complete.sql"


# Pydantic models for server-to-client events
class HintItem(BaseModel):
    """Individual hint item with index and text."""

    idx: int
    hint: str


class HintGenerationProgressPayload(BaseModel):
    """Response indicating progress in hint generation."""

    type: str
    message: str | None = None
    error: str | None = None
    chat_id: str
    message_id: str
    hint_ids: list[str] | None = None
    hints_count: int | None = None
    hints: list[HintItem] | None = None


async def _generate_hints_impl(
    sid: str,
    data: GetHintRunContextAndCreateRunApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Internal implementation for hint generation."""
    chat_id = data.chat_id
    message_id = data.message_id
    department_id = data.department_id

    try:
        async with get_db_connection() as conn:
            # Get context AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            try:
                # Use execute_sql_typed() - auto-detects function
                params = GetHintRunContextAndCreateRunSqlParams(
                    message_id=message_id,
                    chat_id=chat_id,
                    department_id=department_id,
                    profile_id=profile_id,  # From sid lookup
                )
                result = cast(
                    GetHintRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH_GENERATE, params=params),
                )
            except Exception as e:
                import asyncpg  # type: ignore

                error_msg = str(e)
                # Check if it's a rate limit error from SQL (PostgreSQL exception)
                if (
                    isinstance(e, asyncpg.PostgresError)
                    and "RATE_LIMIT_EXCEEDED" in error_msg
                ):
                    # Extract the user-friendly message
                    user_msg = (
                        error_msg.split("RATE_LIMIT_EXCEEDED: ", 1)[1]
                        if "RATE_LIMIT_EXCEEDED: " in error_msg
                        else error_msg
                    )
                    await emit_to_internal(
                        "hint_error",
                        HintGenerationErrorSqlRow(
                            success=False,
                            message=user_msg,
                        ),
                        sid=sid,
                    )
                    return
                await emit_to_internal(
                    "hint_error",
                    HintGenerationErrorSqlRow(
                        success=False,
                        message=f"Failed to initialize hint generation: {str(e)}",
                    ),
                    sid=sid,
                )
                return

            if not result:
                await emit_to_internal(
                    "hint_error",
                    HintGenerationErrorSqlRow(
                        success=False,
                        message=(
                            f"Message {message_id} in chat {chat_id} not found or "
                            f"no hint agent configured for department {department_id}"
                        ),
                    ),
                    sid=sid,
                )
                return

            # result.documents is already a list of composite type objects, no JSON parsing needed
            documents = result.documents or []

            # Validate profile_id is required
            profile_id_str = result.profile_id
            if not profile_id_str:
                await emit_to_internal(
                    "hint_error",
                    HintGenerationErrorSqlRow(
                        success=False,
                        message="profileId is required",
                    ),
                    sid=sid,
                )
                return

            context = {
                "message_id": result.message_id,
                "message_created_at": result.message_created_at,
                "chat_id": result.chat_id,
                "attempt_id": result.attempt_id,
                "scenario_id": result.scenario_id,
                "trace_id": result.trace_id,
                "chat_title": result.chat_title,
                "simulation_id": result.simulation_id,
                "problem_statement": result.problem_statement,
                "agent_id": result.agent_id,
                "agent_name": result.agent_name,
                "system_prompt": result.system_prompt,
                "temperature": float(result.temperature)
                if result.temperature is not None
                else 0.0,
                "reasoning": result.reasoning,
                "model_id": result.model_id,
                "model_name": result.model_name,
                "provider_id": result.provider_id,
                "provider_name": result.provider_name,
                "base_url": result.base_url,
                "api_key": result.api_key,
                "profile_id": profile_id_str,
                "documents": documents,
                "req_per_day": result.req_per_day,
                "runs_today_count": result.runs_today_count,
                "earliest_run_created_at": result.earliest_run_created_at,
            }

            # Extract run_id from result (created in same transaction)
            model_run_id = uuid.UUID(result.run_id)

            # Extract data from context
            chat = {
                "id": uuid.UUID(context["chat_id"]),
                "attempt_id": uuid.UUID(context["attempt_id"]),
                "scenario_id": uuid.UUID(context["scenario_id"]),
                "trace_id": context["trace_id"],
                "title": context["chat_title"],
            }

            attempt = {
                "id": uuid.UUID(context["attempt_id"]),
                "simulation_id": uuid.UUID(context["simulation_id"]),
            }

            message_created_at = context["message_created_at"]

            # Emit start event via internal bus
            await emit_to_internal(
                "hint_progress",
                HintGenerationProgressPayload(
                    type="start",
                    message="Starting hint generation",
                    chat_id=str(chat_id),
                    message_id=str(message_id),
                ),
                sid=sid,
            )

            # Build input items
            input_items: list[TResponseInputItem] = []

            # Format document info if documents are available (no images needed for hints)
            if documents:
                # Convert composite type objects to dict format for format_document_info
                documents_dict = [
                    {
                        "id": str(doc.document_id),
                        "name": doc.name,
                        "file_path": doc.file_path or "",
                        "mime_type": doc.mime_type or "",
                    }
                    for doc in documents
                ]
                document_info = format_document_info(documents_dict, False)
                input_items.append(document_info)

            # Get all messages for the chat using function call (RETURNS TABLE returns multiple rows)
            # execute_sql_typed uses fetchrow which only gets one row, so we use fetch directly for multi-row results
            function_call_sql = "SELECT * FROM socket_get_simulation_messages_v3($1::uuid)"
            message_rows = await conn.fetch(function_call_sql, chat_id)
            all_messages = [dict(row) for row in message_rows]

            # Filter messages up to and including the target message
            messages = [
                msg for msg in all_messages if msg["created_at"] <= message_created_at
            ]

            # Build conversation history (inlined from get_simulation_conversation_history)
            from datetime import datetime

            conversation_history: list[TResponseInputItem] = []

            # Filter out error messages and make a list of all items
            items = [
                msg
                for msg in messages
                if not msg.get("content", "").startswith("Error:")
            ]

            # sort items by created_at
            items = sorted(items, key=lambda x: x.get("created_at", datetime.min))

            # Group messages by type to handle consecutive responses
            current_response_messages: list[dict[str, Any]] = []

            for item in items:
                # Handle both "type" (legacy/test) and "role" (database) fields
                msg_type = item.get("type", "")
                msg_role = item.get("role", "")
                msg_content = item.get("content", "")
                message_id_item = item.get("id", "")

                # Check if this is a user message (type="query" or role="user")
                is_user_message = (
                    msg_type == "query" or msg_role == "user"
                ) and msg_content != ""

                if is_user_message:
                    # If we have pending response messages, add the latest one
                    if current_response_messages:
                        latest_response = current_response_messages[-1]
                        content = latest_response.get("content", "")

                        assistant_message_item: TResponseInputItem = {
                            "role": "assistant",
                            "content": content,
                        }
                        conversation_history.append(assistant_message_item)
                        current_response_messages = []

                    # Add the user message
                    content = msg_content

                    user_message_item: TResponseInputItem = {
                        "role": "user",
                        "content": content,
                    }
                    conversation_history.append(user_message_item)
                # Check if this is an assistant message (type="response" or role="assistant")
                elif (
                    msg_type == "response" or msg_role == "assistant"
                ) and msg_content != "":
                    # Collect response messages to find the latest one
                    current_response_messages.append(item)

            # Handle any remaining response messages at the end
            if current_response_messages:
                latest_response = current_response_messages[-1]
                content = latest_response.get("content", "")

                current_assistant_message_item: TResponseInputItem = {
                    "role": "assistant",
                    "content": content,
                }
                conversation_history.append(current_assistant_message_item)

            # Format scenario from context
            chat_scenario = format_chat_scenario(context["problem_statement"])
            input_items.insert(0, chat_scenario)
            input_items.extend(conversation_history)

            # Add developer message at the end to explicitly request hint generation
            developer_message: TResponseInputItem = {
                "role": "developer",
                "content": "Now please generate the hints based on the previous conversation. You must call the create_hint tool at least 3 times to provide short, concise guidance for the GTA. Each hint should be distinct and focused on different aspects of helping the student (e.g., content explanation, emotional support, pedagogical approach).",
            }
            input_items.append(developer_message)

            # Build hint agent from context
            profile_id_str = context.get("profile_id")

            # Load agent tools from database
            agent_id_uuid = uuid.UUID(context["agent_id"])
            sql_get_agent_tools = load_sql("app/sql/v3/agents/get_agent_tools.sql")
            rows = await conn.fetch(sql_get_agent_tools, str(agent_id_uuid))
            agent_tools_config = [dict(row) for row in rows]
            tool_config_map: dict[str, dict[str, Any]] = {
                tool_config["name"]: tool_config for tool_config in agent_tools_config
            }

            # Create single hint tool (can be called multiple times)
            # Use closure variables to collect hints directly (no storage needed)
            hint_results: list[str] = []

            hint_tools: list[Tool] = []
            hint_config = tool_config_map.get("create_hint")
            if hint_config:
                hint_desc = hint_config.get("argument_descriptions", {}).get(
                    "hint",
                    "A concise, practical teaching strategy or communication tip for the GTA",
                )
            else:
                hint_desc = "A concise, practical teaching strategy or communication tip for the GTA"

            async def create_hint(
                hint: str = Field(description=hint_desc),
            ) -> str:
                """Create a strategic hint for the GTA. Call this tool multiple times to create multiple hints."""
                hint_results.append(hint)
                current_count = len(hint_results)
                if current_count < 3:
                    return f"Hint {current_count} created successfully. Continue until at least 3 hints are created."
                else:
                    return f"Hint {current_count} created successfully. You have created {current_count} hints."

            hint_tools.append(function_tool(create_hint))

            # Add debug_info tool
            from app.infra.v3.debug.debug_info import debug_info

            hint_tools.append(debug_info)

            hint_agent = build_hint_agent(context, hint_tools)

            # Run the hint agent
            with trace(
                chat["title"], trace_id=chat["trace_id"], group_id=str(attempt["id"])
            ):
                result_runner = await Runner.run(
                    hint_agent.agent(),
                    input=input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            # Emit async pricing event (non-blocking)
            # This handles token updates and message logging in background
            usage = result_runner.context_wrapper.usage
            assistant_output = getattr(result_runner, "final_output", None) or ""
            hint_dev_content = "Now please generate the hints based on the previous conversation. You must call the create_hint tool at least 3 times to provide short, concise guidance for the GTA. Each hint should be distinct and focused on different aspects of helping the student."
            # Create input_items with developer message for logging
            input_items_with_dev = input_items + [
                {"role": "developer", "content": hint_dev_content}
            ]
            await internal_sio.emit(
                "log_run",
                {
                    "runId": str(model_run_id),
                    "operationType": "simulation",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": context["system_prompt"],
                    "inputItems": input_items_with_dev,  # Serialized TResponseInputItem list
                    "assistantOutput": assistant_output,
                    "departmentId": str(department_id),
                },
            )
            # Extract hints from closure variables (now a list)
            hints_generated = len(hint_results)
            # Create hints directly in database
            non_empty_hints = [h for h in hint_results if h and h.strip()]

            if non_empty_hints:
                try:
                    # Create hints in single transaction using typed SQL execution
                    create_hints_params = CreateHintsSqlParams(
                        message_id=message_id,
                        hint_texts=non_empty_hints,
                    )
                    create_hints_result = cast(
                        CreateHintsSqlRow,
                        await execute_sql_typed(
                            conn, SQL_PATH_CREATE_HINTS, params=create_hints_params
                        ),
                    )

                    # create_hints_result.hints is already a list of composite type objects
                    hints_list = create_hints_result.hints or []

                    if hints_list:
                        # Emit completion event via internal bus
                        hints_for_event = [
                            HintItem(idx=hint.idx, hint=hint.hint)
                            for hint in hints_list
                        ]

                        await emit_to_internal(
                            "hint_complete",
                            HintGenerationProgressPayload(
                                type="complete",
                                message="Hints created successfully",
                                chat_id=str(chat_id),
                                message_id=str(message_id),
                                hint_ids=[
                                    f"{hint.simulation_message_id}_{hint.idx}"
                                    for hint in hints_list
                                ],
                                hints_count=len(hints_list),
                                hints=hints_for_event,
                            ),
                            sid=sid,
                        )
                    else:
                        await emit_to_internal(
                            "hint_error",
                            HintGenerationErrorSqlRow(
                                success=False,
                                message="Failed to create hints in database",
                            ),
                            sid=sid,
                        )
                except Exception as create_error:
                    await emit_to_internal(
                        "hint_error",
                        HintGenerationErrorSqlRow(
                            success=False,
                            message=f"Failed to create hints: {str(create_error)}",
                        ),
                        sid=sid,
                    )
            else:
                # No non-empty hints provided
                await emit_to_internal(
                    "hint_error",
                    HintGenerationErrorSqlRow(
                        success=False,
                        message="No valid hints generated",
                    ),
                    sid=sid,
                )
    except RuntimeError:
        # Pool not initialized - emit error event
        await emit_to_internal(
            "hint_error",
            HintGenerationErrorSqlRow(
                success=False,
                message="Database connection pool not available",
            ),
            sid=sid,
        )
    except Exception as e:
        # Emit error event
        await emit_to_internal(
            "hint_error",
            HintGenerationErrorSqlRow(
                success=False,
                message=f"Hint generation failed: {str(e)}",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def simulation_hints_generate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    await handle_client_event(
        sid=sid,
        data=data,
        request_type=GetHintRunContextAndCreateRunApiRequest,
        handler=_generate_hints_impl,  # type: ignore[arg-type]
        error_event_name="simulation_hints_error",
        error_response_type=HintGenerationErrorSqlRow,
    )


@internal_sio.on("simulation_hints_generate")
async def simulation_hints_generate_internal(data: dict[str, Any]) -> None:
    """Internal event handler for hint generation (called from other handlers)."""
    # Extract sid from payload if available
    sid = data.get("sid", "internal")
    chat_id = uuid.UUID(data["chat_id"])
    message_id = uuid.UUID(data["message_id"])
    department_id = uuid.UUID(data["department_id"])
    
    # Create request object for handler
    request = GetHintRunContextAndCreateRunApiRequest(
        chat_id=str(chat_id),
        message_id=str(message_id),
        department_id=str(department_id),
    )
    
    # Get profile_id from sid lookup
    from app.infra.v3.websocket.find_profile_by_socket import find_profile_by_socket
    
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        await emit_to_internal(
            "hint_error",
            HintGenerationErrorSqlRow(
                success=False,
                message="No profile found for socket",
            ),
            sid=sid,
        )
        return
    
    profile_id = uuid.UUID(profile_id_str)
    await _generate_hints_impl(sid, request, profile_id)


register_client_endpoint(
    client_router,
    "/generate",
    GetHintRunContextAndCreateRunApiRequest,
    "Generate hints for a simulation message",
)


register_client_endpoint(
    server_router,
    "/generation_progress",
    HintGenerationProgressPayload,
    "Hint generation progress update",
)
