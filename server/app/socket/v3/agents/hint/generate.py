"""Handler for simulation_hints_generate WebSocket event."""

import json
import uuid
from typing import Any

from agents import Runner, Tool, function_tool, trace
from agents.items import TResponseInputItem
from fastapi import APIRouter
from pydantic import BaseModel, Field, ValidationError
from utils.logging.db_logger import get_logger
from utils.sql_helper import load_sql

from app.infra.v3.agents.utils.build_hint_agent import build_hint_agent
from app.infra.v3.chat.format_chat_scenario import format_chat_scenario
from app.infra.v3.debug.debug_info import DebugContext
from app.infra.v3.documents.format_document_info import format_document_info
from app.main import get_internal_sio, get_pool, sio

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
            sql = load_sql("app/sql/v3/simulations/generate_hints_complete.sql")
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
            sql = load_sql("app/sql/v3/simulations/get_simulation_messages.sql")
            message_rows = await conn.fetch(sql, str(chat_id))
            all_messages = [dict(row) for row in message_rows]

            # Filter messages up to and including the target message
            messages = [
                msg for msg in all_messages if msg["created_at"] <= message_created_at
            ]

            # Build conversation history (inlined from get_simulation_conversation_history)
            from datetime import datetime

            conversation_history: list[TResponseInputItem] = []
            message_id_map: dict[str, int] = {}
            message_number = 1

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
                message_id = item.get("id", "")

                # Check if this is a user message (type="query" or role="user")
                is_user_message = (
                    msg_type == "query" or msg_role == "user"
                ) and msg_content != ""

                if is_user_message:
                    # If we have pending response messages, add the latest one
                    if current_response_messages:
                        latest_response = current_response_messages[-1]
                        response_id = latest_response.get("id", "")
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
                response_id = latest_response.get("id", "")
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
                logger.info(f"✓ Created hint {current_count}: {hint[:80]}...")
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

            logger.info("Hint agent completed successfully")

            # Extract hints from closure variables (now a list)
            hints_generated = len(hint_results)
            logger.info(f"Generated {hints_generated} hints")

            if hints_generated < 3:
                logger.warning(
                    f"Not all hints were generated for message {message_id}. "
                    f"Got {hints_generated} hints, expected at least 3"
                )

            # Create hints directly in database
            non_empty_hints = [h for h in hint_results if h and h.strip()]

            if non_empty_hints:
                try:
                    # Create hints in single transaction
                    sql_create_hints = load_sql(
                        "app/sql/v3/simulations/create_hints_complete.sql"
                    )
                    result_row = await conn.fetchrow(
                        sql_create_hints, str(message_id), non_empty_hints
                    )

                    if result_row and result_row.get("hint_ids"):
                        hint_ids = result_row["hint_ids"]
                        if isinstance(hint_ids, str):
                            hint_ids = json.loads(hint_ids)
                        elif hint_ids is None:
                            hint_ids = []

                        logger.info(
                            f"Created {len(hint_ids)} hints for message {message_id} in chat {chat_id}"
                        )

                        # Emit completion event
                        hints_for_event = [
                            HintItem(idx=h["idx"], hint=h.get("hint", ""))
                            for h in hint_ids
                        ]

                        await hint_generation_progress(
                            HintGenerationProgressPayload(
                                type="complete",
                                message="Hints created successfully",
                                chat_id=str(chat_id),
                                message_id=str(message_id),
                                hint_ids=[
                                    f"{h['simulation_message_id']}_{h['idx']}"
                                    for h in hint_ids
                                ],
                                hints_count=len(hint_ids),
                                hints=hints_for_event,
                            ),
                            room=f"simulation_{chat_id}",
                        )
                    else:
                        logger.error(f"Failed to create hints for message {message_id}")
                        await hint_generation_progress(
                            HintGenerationProgressPayload(
                                type="error",
                                message="Failed to create hints in database",
                                error="Database operation failed",
                                chat_id=str(chat_id),
                                message_id=str(message_id),
                            ),
                            room=f"simulation_{chat_id}",
                        )
                except Exception as create_error:
                    logger.error(
                        f"Error creating hints for message {message_id}: {create_error}",
                        exc_info=True,
                    )
                    await hint_generation_progress(
                        HintGenerationProgressPayload(
                            type="error",
                            message=f"Failed to create hints: {str(create_error)}",
                            error=str(create_error),
                            chat_id=str(chat_id),
                            message_id=str(message_id),
                        ),
                        room=f"simulation_{chat_id}",
                    )
            else:
                logger.warning(f"No non-empty hints provided for message {message_id}")
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
