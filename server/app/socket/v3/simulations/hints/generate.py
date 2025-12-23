"""Handler for simulation_hints_generate WebSocket event."""

import json
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

from agents import Runner, Tool, function_tool, trace
from agents.items import TResponseInputItem
from app.main import get_internal_sio, get_pool, sio
from app.utils.agents.build_hint_agent import build_hint_agent
from app.utils.chat.format_chat_scenario import format_chat_scenario
from app.utils.chat.get_simulation_conversation_history import \
    get_simulation_conversation_history
from app.utils.debug_info import DebugContext
from app.utils.document.format_document_info import format_document_info
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from fastapi import APIRouter
from pydantic import BaseModel, Field, ValidationError

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


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


# Pydantic model for client-to-server event
class GenerateHintsPayload(BaseModel):
    """Request to generate hints for a simulation message."""

    chat_id: str
    message_id: str
    department_id: str


# Emit helper functions
async def hint_generation_progress(
    payload: HintGenerationProgressPayload, room: str
) -> None:
    await sio.emit(
        "simulations_text_hint_generation_progress",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def _generate_hints_impl(
    chat_id: uuid.UUID,
    message_id: uuid.UUID,
    department_id: uuid.UUID,
) -> None:
    """Internal implementation for hint generation."""
    """Internal implementation for hint generation."""
    pool = get_pool()
    if not pool:
        logger.error("Database connection pool not available for hint generation")
        await hint_generation_progress(
            HintGenerationProgressPayload(
                type="error",
                message="Database connection pool not available",
                error="Database connection pool not available",
                chat_id=str(chat_id),
                message_id=str(message_id),
            ),
            room=f"simulation_{chat_id}",
        )
        return

    async with pool.acquire() as conn:
        try:
            logger.info(
                f"Starting hint generation for chat {chat_id}, message {message_id}"
            )

            # Get context AND create run in single atomic transaction
            # This validates rate limits and creates run atomically
            sql = load_sql("sql/v3/simulations/generate_hints_complete.sql")
            try:
                context_row = await conn.fetchrow(
                    sql, str(message_id), str(chat_id), str(department_id)
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
                    await hint_generation_progress(
                        HintGenerationProgressPayload(
                            type="error",
                            message=user_msg,
                            error=user_msg,
                            chat_id=str(chat_id),
                            message_id=str(message_id),
                        ),
                        room=f"simulation_{chat_id}",
                    )
                    return
                # Log other errors
                logger.error(
                    f"Failed to get context and create run for hint generation: {str(e)}",
                    exc_info=True,
                )
                await hint_generation_progress(
                    HintGenerationProgressPayload(
                        type="error",
                        message=f"Failed to initialize hint generation: {str(e)}",
                        error=str(e),
                        chat_id=str(chat_id),
                        message_id=str(message_id),
                    ),
                    room=f"simulation_{chat_id}",
                )
                return

            if not context_row:
                await hint_generation_progress(
                    HintGenerationProgressPayload(
                        type="error",
                        message=(
                            f"Message {message_id} in chat {chat_id} not found or "
                            f"no hint agent configured for department {department_id}"
                        ),
                        error="Context not found",
                        chat_id=str(chat_id),
                        message_id=str(message_id),
                    ),
                    room=f"simulation_{chat_id}",
                )
                return

            # Parse JSON array for documents
            documents = (
                json.loads(context_row["documents"])
                if isinstance(context_row["documents"], str)
                else context_row["documents"]
            )

            # Validate profile_id is required
            profile_id = context_row["profile_id"]
            if not profile_id:
                await hint_generation_progress(
                    HintGenerationProgressPayload(
                        type="error",
                        message="profileId is required",
                        error="Missing profile_id",
                        chat_id=str(chat_id),
                        message_id=str(message_id),
                    ),
                    room=f"simulation_{chat_id}",
                )
                return

            context = {
                "message_id": context_row["message_id"],
                "message_created_at": context_row["message_created_at"],
                "chat_id": context_row["chat_id"],
                "attempt_id": context_row["attempt_id"],
                "scenario_id": context_row["scenario_id"],
                "trace_id": context_row["trace_id"],
                "chat_title": context_row["chat_title"],
                "simulation_id": context_row["simulation_id"],
                "problem_statement": context_row["problem_statement"],
                "agent_id": context_row["agent_id"],
                "agent_name": context_row["agent_name"],
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
                "profile_id": profile_id,
                "documents": documents,
                "req_per_day": context_row["req_per_day"],
                "runs_today_count": context_row["runs_today_count"],
                "earliest_run_created_at": context_row["earliest_run_created_at"],
            }

            # Extract run_id from context (created in same transaction)
            model_run_id = uuid.UUID(context_row["run_id"])

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

            # Emit start event
            await hint_generation_progress(
                HintGenerationProgressPayload(
                    type="start",
                    message="Starting hint generation",
                    chat_id=str(chat_id),
                    message_id=str(message_id),
                ),
                room=f"simulation_{chat_id}",
            )

            # Build input items
            input_items: list[TResponseInputItem] = []

            # Format document info if documents are available (no images needed for hints)
            if context["documents"]:
                document_info = format_document_info(context["documents"], False)
                input_items.append(document_info)

            # Get all messages for the chat using SQL file
            sql = load_sql("sql/v3/simulations/get_simulation_messages.sql")
            message_rows = await conn.fetch(sql, str(chat_id))
            all_messages = [dict(row) for row in message_rows]

            # Filter messages up to and including the target message
            messages = [
                msg for msg in all_messages if msg["created_at"] <= message_created_at
            ]

            # Build conversation history
            conversation_history, _ = get_simulation_conversation_history(messages)

            # Format scenario from context
            chat_scenario = format_chat_scenario(context["problem_statement"])
            input_items.insert(0, chat_scenario)
            input_items.extend(conversation_history)

            # Add developer message at the end to explicitly request hint generation
            developer_message: TResponseInputItem = {
                "role": "developer",
                "content": "Now please generate the hints based on the previous conversation. You must call all three hint tools (provide_hint_1, provide_hint_2, and provide_hint_3) to provide short, concise guidance for the GTA.",
            }
            input_items.append(developer_message)

            # Build hint agent from context
            profile_id_str = context.get("profile_id")

            # Load agent tools from database
            agent_id_uuid = uuid.UUID(context["agent_id"])
            sql_get_agent_tools = load_sql("sql/v3/agents/get_agent_tools.sql")
            rows = await conn.fetch(sql_get_agent_tools, str(agent_id_uuid))
            agent_tools_config = [dict(row) for row in rows]
            tool_config_map: dict[str, dict[str, Any]] = {
                tool_config["name"]: tool_config for tool_config in agent_tools_config
            }

            # Create hint tools inline
            # Use closure variables to collect hints directly (no storage needed)
            hint_results: dict[str, str] = {}
            
            hint_tools: list[Tool] = []
            for i in range(1, 4):  # 1, 2, 3
                tool_name = f"provide_hint_{i}"
                hint_config = tool_config_map.get(tool_name)
                if hint_config:
                    hint_desc = hint_config.get("argument_descriptions", {}).get(
                        "hint",
                        f"A concise, practical teaching strategy or communication tip for the GTA. This is hint #{i} of 3 required hints.",
                    )
                else:
                    hint_desc = f"A concise, practical teaching strategy or communication tip for the GTA. This is hint #{i} of 3 required hints."

                # Create function with proper closure capture
                def make_hint_function(
                    hint_number: int, description: str
                ) -> Callable[[str], Awaitable[str]]:
                    async def provide_hint(hint: str = Field(description=description)) -> str:
                        """Provide a strategic hint for the GTA."""
                        hint_results[f"hint_{hint_number}"] = hint
                        logger.info(f"✓ Hint {hint_number} recorded: {hint[:80]}...")
                        return f"Hint {hint_number} recorded successfully. Continue until all 3 hints are provided."

                    provide_hint.__name__ = tool_name
                    return provide_hint

                provide_hint_func = make_hint_function(i, hint_desc)
                hint_tools.append(function_tool(provide_hint_func))

            # Add debug_info tool
            from app.utils.debug_info import debug_info

            hint_tools.append(debug_info)

            hint_agent = build_hint_agent(context, hint_tools)

            # Run the hint agent
            logger.info("Running hint agent with parallel tool calls...")
            with trace(
                chat["title"], trace_id=chat["trace_id"], group_id=str(attempt["id"])
            ):
                result = await Runner.run(
                    hint_agent.agent(),
                    input=input_items,
                    context=DebugContext(conn=conn, run_id=model_run_id),
                )

            # Emit async pricing event (non-blocking)
            # This handles token updates and message logging in background
            usage = result.context_wrapper.usage
            assistant_output = getattr(result, "final_output", None) or ""
            hint_dev_content = "Now please generate the hints based on the previous conversation. You must call all three hint tools (provide_hint_1, provide_hint_2, and provide_hint_3) to provide short, concise guidance for the GTA."
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

            logger.info("Hint agent completed successfully")

            # Extract hints from closure variables
            hint_1 = hint_results.get("hint_1", "")
            hint_2 = hint_results.get("hint_2", "")
            hint_3 = hint_results.get("hint_3", "")

            # Log what was generated
            hints_generated = sum([bool(hint_1), bool(hint_2), bool(hint_3)])
            logger.info(f"Generated {hints_generated}/3 hints")

            if hints_generated < 3:
                logger.warning(
                    f"Not all hints were generated for message {message_id}. "
                    f"Got: hint_1={bool(hint_1)}, hint_2={bool(hint_2)}, hint_3={bool(hint_3)}"
                )

            # Emit internal event to create hints (separate event for database operations)
            hints_list = [hint_1, hint_2, hint_3]
            non_empty_hints = [h for h in hints_list if h and h.strip()]

            if non_empty_hints:
                await internal_sio.emit(
                    "simulation_hints_create",
                    {
                        "chat_id": str(chat_id),
                        "message_id": str(message_id),
                        "hints": non_empty_hints,
                    },
                )

            # Note: Completion event will be emitted by simulation_hints_create handler
            # after hints are successfully created in the database
            logger.info(
                f"Hint generation completed: {len(non_empty_hints)} hints to be created"
            )
        except Exception as e:
            logger.error(
                f"Hint generation failed for message {message_id}: {e}",
                exc_info=True,
            )

            # Emit error event
            try:
                await hint_generation_progress(
                    HintGenerationProgressPayload(
                        type="error",
                        message=f"Hint generation failed: {str(e)}",
                        error=str(e),
                        chat_id=str(chat_id),
                        message_id=str(message_id),
                    ),
                    room=f"simulation_{chat_id}",
                )
            except Exception as emit_err:
                logger.warning(f"Failed to emit error event: {emit_err}")


@sio.event  # type: ignore
async def simulation_hints_generate(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = GenerateHintsPayload(**data)
        await _generate_hints_impl(
            uuid.UUID(validated.chat_id),
            uuid.UUID(validated.message_id),
            uuid.UUID(validated.department_id),
        )
    except ValidationError as e:
        logger.error(f"Validation error in simulation_hints_generate for {sid}: {e}")
        await hint_generation_progress(
            HintGenerationProgressPayload(
                type="error",
                message=f"Invalid payload: {str(e)}",
                error=str(e),
                chat_id=data.get("chat_id", "unknown"),
                message_id=data.get("message_id", "unknown"),
            ),
            room=sid,
        )


@internal_sio.on("simulation_hints_generate")
async def simulation_hints_generate_internal(data: dict[str, Any]) -> None:
    """Internal event handler for hint generation (called from other handlers)."""
    """Internal event handler for hint generation (called from other handlers)"""
    try:
        chat_id = uuid.UUID(data["chat_id"])
        message_id = uuid.UUID(data["message_id"])
        department_id = uuid.UUID(data["department_id"])
        await _generate_hints_impl(chat_id, message_id, department_id)
    except Exception as e:
        logger.error(
            f"Error in internal simulation_hints_generate: {e}",
            exc_info=True,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/generate", response_model=dict[str, bool])
async def simulation_hints_generate_api(
    request: GenerateHintsPayload,
) -> dict[str, bool]:
    """Client-to-server event: Generate hints for a simulation message."""
    return {"success": True}


@server_router.post("/generation_progress", response_model=dict[str, bool])
async def hint_generation_progress_api(
    request: HintGenerationProgressPayload,
) -> dict[str, bool]:
    """Server-to-client event: Hint generation progress update."""
    return {"success": True}

