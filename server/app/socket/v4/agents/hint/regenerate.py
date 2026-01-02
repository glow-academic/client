"""Handler for simulation_hints_regenerate WebSocket event."""

import uuid
from typing import Any, cast

from agents import Runner, Tool, function_tool, trace
from agents.items import TResponseInputItem
from fastapi import APIRouter
from pydantic import BaseModel, Field
from utils.sql_helper import execute_sql_typed, load_sql

from app.infra.v4.agents.utils.build_hint_agent import build_hint_agent
from app.infra.v4.chat.format_chat_scenario import format_chat_scenario
from app.infra.v4.debug.debug_info import DebugContext
from app.infra.v4.documents.format_document_info import format_document_info
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_client_event
from app.infra.v4.websocket.openapi_helpers import register_client_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
# Types will be auto-generated from SQL introspection
try:
    from app.sql.types import (
        GetHintRegenerationRunContextAndCreateRunSqlParams,
        GetHintRegenerationRunContextAndCreateRunSqlRow,
        CreateHintsSqlParams,
        CreateHintsSqlRow,
        GetSimulationMessagesSqlParams,
        GetSimulationMessagesSqlRow,
    )
except ImportError:
    # Types not generated yet - will be created when SQL files are processed
    from pydantic import BaseModel

    class GetHintRegenerationRunContextAndCreateRunSqlParams(BaseModel):
        message_id: uuid.UUID
        chat_id: uuid.UUID
        department_id: uuid.UUID
        profile_id: uuid.UUID
        hint_agent_id: uuid.UUID
        group_id: uuid.UUID
        user_instructions: str | None = None

    class GetHintRegenerationRunContextAndCreateRunSqlRow(BaseModel):
        message_id: str
        message_created_at: str
        chat_id: str
        attempt_id: str
        scenario_id: str
        trace_id: str
        chat_title: str
        simulation_id: str
        problem_statement: str
        agent_id: str
        agent_name: str
        system_prompt: str
        temperature: float
        reasoning: str
        model_id: str
        model_name: str
        provider_name: str
        base_url: str
        api_key: str
        provider_id: str
        profile_id: str
        req_per_day: int
        runs_today_count: int
        earliest_run_created_at: str | None
        documents: list[Any] | None = None
        run_id: str
        group_id: uuid.UUID
        previous_messages: list[Any] | None = None

    class CreateHintsSqlParams(BaseModel):
        message_id: uuid.UUID
        hint_texts: list[str]

    class CreateHintsSqlRow(BaseModel):
        hints: list[Any] | None = None

    class GetSimulationMessagesSqlParams(BaseModel):
        chat_id: uuid.UUID

    class GetSimulationMessagesSqlRow(BaseModel):
        messages: list[Any] | None = None

from app.socket.v4.agents.hint.error import HintErrorPayload
from app.socket.v4.agents.hint.generate import HintGenerationProgressPayload, HintItem

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/simulations/get_hint_regeneration_run_context_and_create_run_complete.sql"
SQL_PATH_MESSAGES = "app/sql/v4/simulations/get_simulation_messages_complete.sql"
SQL_PATH_CREATE_HINTS = "app/sql/v4/simulations/create_hints_complete.sql"


async def _hint_regenerate_impl(
    sid: str,
    data: dict[str, Any],  # Will be validated by handle_client_event
    profile_id: uuid.UUID,
) -> None:
    """Internal implementation for hint regeneration."""
    chat_id = uuid.UUID(data["chat_id"]) if isinstance(data["chat_id"], str) else data["chat_id"]
    message_id = uuid.UUID(data["message_id"]) if isinstance(data["message_id"], str) else data["message_id"]
    department_id = uuid.UUID(data["department_id"]) if isinstance(data["department_id"], str) else data["department_id"]
    hint_agent_id = uuid.UUID(data["hint_agent_id"]) if isinstance(data["hint_agent_id"], str) else data["hint_agent_id"]
    group_id = uuid.UUID(data["group_id"])  # REQUIRED for regeneration
    user_instructions = data.get("user_instructions")

    try:
        async with get_db_connection() as conn:
            # Get all context data AND create run in single atomic transaction
            # This validates rate limits, creates run, gets all previous messages,
            # and links existing system/developer messages atomically
            try:
                # Use execute_sql_typed() - auto-detects function
                params = GetHintRegenerationRunContextAndCreateRunSqlParams(
                    message_id=message_id,
                    chat_id=chat_id,
                    department_id=department_id,
                    profile_id=profile_id,  # From sid lookup
                    hint_agent_id=hint_agent_id,
                    group_id=group_id,  # REQUIRED for regeneration (uses existing group)
                    user_instructions=user_instructions,
                )
                result = cast(
                    GetHintRegenerationRunContextAndCreateRunSqlRow,
                    await execute_sql_typed(conn, SQL_PATH, params=params),
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
                        HintErrorPayload(
                            success=False,
                            message=user_msg,
                        ),
                        sid=sid,
                    )
                    return
                await emit_to_internal(
                    "hint_error",
                    HintErrorPayload(
                        success=False,
                        message=f"Failed to initialize hint regeneration: {str(e)}",
                    ),
                    sid=sid,
                )
                return

            if not result:
                await emit_to_internal(
                    "hint_error",
                    HintErrorPayload(
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
                    HintErrorPayload(
                        success=False,
                        message="profileId is required",
                    ),
                    sid=sid,
                )
                return

            # Get previous messages from result (already properly typed as composite types)
            previous_messages: list[TResponseInputItem] = []
            if result.previous_messages:
                previous_messages = [
                    cast(
                        TResponseInputItem,
                        {
                            "role": msg.role or "",
                            "content": msg.content or "",
                        },
                    )
                    for msg in result.previous_messages
                ]

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
                    message="Starting hint regeneration",
                    chat_id=str(chat_id),
                    message_id=str(message_id),
                ),
                sid=sid,
            )

            # Build input items: previous messages + document context + chat scenario + user instructions
            input_items: list[TResponseInputItem] = []

            # Add previous messages first (conversation history from all runs)
            input_items.extend(previous_messages)

            # Format document info if documents are available (no images needed for hints)
            if documents:
                # Convert composite type objects to dict format for format_document_info
                documents_dict = [
                    {
                        "id": str(doc.document_id) if hasattr(doc, "document_id") else str(getattr(doc, "id", "")),
                        "name": getattr(doc, "name", ""),
                        "file_path": getattr(doc, "file_path", "") or "",
                        "mime_type": getattr(doc, "mime_type", "") or "",
                    }
                    for doc in documents
                ]
                document_info = format_document_info(documents_dict, False)
                input_items.append(document_info)

            # Format scenario from context
            chat_scenario = format_chat_scenario(context["problem_statement"])
            input_items.append(chat_scenario)

            # Add developer message with user instructions on top
            if user_instructions and user_instructions.strip():
                developer_message: TResponseInputItem = {
                    "role": "developer",
                    "content": f"Now please regenerate the hints based on the previous conversation. You must call the create_hint tool at least 3 times to provide short, concise guidance for the GTA. Each hint should be distinct and focused on different aspects of helping the student (e.g., content explanation, emotional support, pedagogical approach).\n\nUser Instructions: {user_instructions}",
                }
            else:
                developer_message: TResponseInputItem = {
                    "role": "developer",
                    "content": "Now please regenerate the hints based on the previous conversation. You must call the create_hint tool at least 3 times to provide short, concise guidance for the GTA. Each hint should be distinct and focused on different aspects of helping the student (e.g., content explanation, emotional support, pedagogical approach).",
                }
            input_items.append(developer_message)

            # Build hint agent from context
            profile_id_str = context.get("profile_id")

            # Load agent tools from database
            agent_id_uuid = uuid.UUID(context["agent_id"])
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
            from app.infra.v4.debug.debug_info import debug_info

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
            await internal_sio.emit(
                "log_run",
                {
                    "runId": str(model_run_id),
                    "operationType": "hint_regeneration",
                    "inputTextTokens": usage.input_tokens,
                    "outputTextTokens": usage.output_tokens,
                    "systemPrompt": context["system_prompt"],
                    "inputItems": input_items,  # Serialized TResponseInputItem list
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
                                message="Hints regenerated successfully",
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
                            HintErrorPayload(
                                success=False,
                                message="Failed to create hints in database",
                            ),
                            sid=sid,
                        )
                except Exception as create_error:
                    await emit_to_internal(
                        "hint_error",
                        HintErrorPayload(
                            success=False,
                            message=f"Failed to create hints: {str(create_error)}",
                        ),
                        sid=sid,
                    )
            else:
                # No non-empty hints provided
                await emit_to_internal(
                    "hint_error",
                    HintErrorPayload(
                        success=False,
                        message="No valid hints generated",
                    ),
                    sid=sid,
                )
    except RuntimeError:
        # Pool not initialized - emit error event
        await emit_to_internal(
            "hint_error",
            HintErrorPayload(
                success=False,
                message="Database connection pool not available",
            ),
            sid=sid,
        )
    except Exception as e:
        # Emit error event
        await emit_to_internal(
            "hint_error",
            HintErrorPayload(
                success=False,
                message=f"Hint regeneration failed: {str(e)}",
            ),
            sid=sid,
        )


# Pydantic model for client-to-server event
class HintRegeneratePayload(BaseModel):
    """Request to regenerate hints for a simulation message."""

    chat_id: str
    message_id: str
    department_id: str
    hint_agent_id: str
    group_id: str  # REQUIRED for regeneration
    user_instructions: str | None = None


@sio.event  # type: ignore
async def simulation_hints_regenerate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    await handle_client_event(
        sid=sid,
        data=data,
        request_type=HintRegeneratePayload,
        handler=_hint_regenerate_impl,  # type: ignore[arg-type]
        error_event_name="simulation_hints_error",
        error_response_type=HintErrorPayload,
    )


register_client_endpoint(
    client_router,
    "/regenerate",
    HintRegeneratePayload,
    "Regenerate hints for a simulation message",
)

