"""Handler for simulation_text_send WebSocket event."""

import asyncio
import json
import uuid
from typing import Any

from agents import Runner, trace
from agents.exceptions import OutputGuardrailTripwireTriggered
from agents.items import TResponseInputItem
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.main import (
    get_hint_storage,
    get_internal_sio,
    get_pool,
    get_simulation_tool_calls_dict,
    sio,
)
from app.utils.agents.build_hint_agent import build_hint_agent
from app.utils.agents.generic_agent import GenericAgent
from app.utils.agents.tools.create_hint_tools import create_hint_tools
from app.utils.agents.tools.create_persona_tools import (
    create_persona_tools,
    find_persona_by_name,
)
from app.utils.chat.format_chat_scenario import format_chat_scenario
from app.utils.chat.get_simulation_conversation_history import (
    get_simulation_conversation_history,
)
from app.utils.debug_info import DebugContext
from app.utils.document.format_document_info import format_document_info
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from app.utils.storage.request_storage import build_storage_key

logger = get_logger(__name__)
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# Helper functions for incremental JSON parsing
def extract_persona_from_json(json_str: str) -> str | None:
    """Extract persona field from partial JSON string."""
    import re

    # Look for "persona": "value" pattern
    match = re.search(r'"persona"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"', json_str)
    if match:
        # Decode escaped characters
        persona_str = match.group(1)
        try:
            # Handle JSON escape sequences
            return persona_str.encode("utf-8").decode("unicode_escape")
        except Exception:
            return persona_str
    return None


def extract_new_message_chars(
    prev_json: str, new_json: str, last_index: int
) -> tuple[str, int, bool]:
    """Extract new message characters from JSON string incrementally.

    Returns:
        Tuple of (new_message_chars, new_last_index, in_message_flag)
    """
    if len(new_json) <= last_index:
        return "", last_index, False

    # Find the start of the message field value in the new JSON
    message_start_pattern = '"message"'
    message_start_idx = new_json.find(message_start_pattern, 0)
    if message_start_idx == -1:
        return "", last_index, False

    # Find the colon after "message"
    colon_idx = new_json.find(":", message_start_idx)
    if colon_idx == -1:
        return "", last_index, False

    # Find the opening quote of the value
    quote_idx = new_json.find('"', colon_idx)
    if quote_idx == -1:
        return "", last_index, False

    # Start reading from after the opening quote
    message_value_start = quote_idx + 1

    # If we haven't reached the message value start yet, check if we can start extracting
    if last_index < message_value_start:
        # Check if we've now reached or passed the message value start
        if len(new_json) > message_value_start:
            # We've reached the message value and have characters to extract
            start_extracting_from = message_value_start
        elif len(new_json) == message_value_start:
            # We've reached the opening quote but no content yet - update last_index and return
            return "", message_value_start, False
        else:
            # Still haven't reached the message value
            return "", last_index, False
    else:
        # We're already past the start, continue from last_index
        start_extracting_from = last_index

    # Extract characters from start_extracting_from to end (or closing quote)
    new_chars = []
    i = start_extracting_from
    in_message = True  # We're definitely in the message value now
    escape_next = False

    while i < len(new_json):
        char = new_json[i]

        if escape_next:
            # Previous char was backslash, include this char as-is
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
            # Exiting message value
            break

        # We're in the message value, add the character
        new_chars.append(char)
        i += 1

    new_message = "".join(new_chars)
    return new_message, i, in_message


# Pydantic models for server-to-client events
class SendSimulationMessageErrorPayload(BaseModel):
    """Response indicating an error occurred while sending simulation message."""

    success: bool
    message: str


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


class SimulationNewMessagePayload(BaseModel):
    """Response indicating a new simulation message was created."""

    message_id: str
    chat_id: str
    role: str
    content: str
    completed: bool
    created_at: str
    persona_id: str | None = None


class SimulationMessageTokenPayload(BaseModel):
    """Response indicating a token was received for a simulation message."""

    message_id: str
    chat_id: str
    token: str
    accumulated_content: str


class SimulationMessageCompletePayload(BaseModel):
    """Response indicating a simulation message was completed."""

    message_id: str
    chat_id: str
    final_content: str


class SimulationMessageErrorPayload(BaseModel):
    """Response indicating an error occurred in a simulation message."""

    chat_id: str
    error: str


class SimulationMessageCancelledPayload(BaseModel):
    """Response indicating a simulation message was cancelled."""

    message_id: str
    chat_id: str
    final_content: str


class SimulationRunCompletePayload(BaseModel):
    """Response indicating a simulation run was completed."""

    chat_id: str


class MessageSentPayload(BaseModel):
    """Response indicating a message was sent."""

    message_id: str
    chat_id: str
    message: str
    created_at: str


# Pydantic model for client-to-server event
class SendSimulationMessagePayload(BaseModel):
    """Request to send a simulation message."""

    chat_id: str
    message: str | None = None
    is_retry: bool = False


# Emit helper functions
async def simulation_text_send_error(
    payload: SendSimulationMessageErrorPayload, room: str
) -> None:
    await sio.emit("simulations_text_send_error", payload.model_dump(), room=room)


async def hint_generation_progress(
    payload: HintGenerationProgressPayload, room: str
) -> None:
    await sio.emit(
        "simulations_text_hint_generation_progress",
        payload.model_dump(exclude_none=True),
        room=room,
    )


async def simulation_new_message(
    payload: SimulationNewMessagePayload, room: str
) -> None:
    await sio.emit("simulations_text_new_message", payload.model_dump(), room=room)


async def simulation_message_token(
    payload: SimulationMessageTokenPayload, room: str
) -> None:
    await sio.emit("simulations_text_message_token", payload.model_dump(), room=room)


async def simulation_message_complete(
    payload: SimulationMessageCompletePayload, room: str
) -> None:
    await sio.emit("simulations_text_message_complete", payload.model_dump(), room=room)


async def simulation_message_error(
    payload: SimulationMessageErrorPayload, room: str
) -> None:
    await sio.emit("simulations_text_message_error", payload.model_dump(), room=room)


async def simulation_message_cancelled(
    payload: SimulationMessageCancelledPayload, room: str
) -> None:
    await sio.emit(
        "simulations_text_message_cancelled", payload.model_dump(), room=room
    )


async def simulation_run_complete(
    payload: SimulationRunCompletePayload, room: str
) -> None:
    await sio.emit("simulations_text_run_complete", payload.model_dump(), room=room)


async def message_sent(payload: MessageSentPayload, room: str) -> None:
    await sio.emit("simulations_text_message_sent", payload.model_dump(), room=room)


async def _generate_hints_background_inline(
    chat_id: uuid.UUID,
    message_id: uuid.UUID,
    department_id: uuid.UUID,
) -> None:
    """
    Background task to generate hints for a completed simulation message.
    Runs independently and emits progress via Socket.IO.
    Inlined from simulations/utils.py to remove abstraction layer.
    """
    pool = get_pool()
    if not pool:
        logger.error("Database connection pool not available for hint generation")
        return

    async with pool.acquire() as conn:
        try:
            logger.info(f"Background hint generation started for message {message_id}")

            # Clear previous results (now handled by storage with keys)

            # Get all hint context data using SQL file
            sql = load_sql("sql/v3/agents/get_hint_run_context.sql")
            context_row = await conn.fetchrow(
                sql, str(message_id), str(chat_id), str(department_id)
            )

            if not context_row:
                raise ValueError(
                    f"Message {message_id} in chat {chat_id} not found or "
                    f"no hint agent configured for department {department_id}"
                )

            # Parse JSON array for documents
            documents = (
                json.loads(context_row["documents"])
                if isinstance(context_row["documents"], str)
                else context_row["documents"]
            )

            # Resolve guest profile if needed
            profile_id = context_row["profile_id"]
            if not profile_id:
                sql_guest = load_sql("sql/v3/profile/get_default_guest_profile.sql")
                guest_row = await conn.fetchrow(sql_guest)
                if guest_row:
                    profile_id = guest_row["id"]

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

            logger.info(
                f"Starting hint generation for chat {chat_id}, message {message_id}"
            )

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
            conversation_history = get_simulation_conversation_history(messages)

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

            # Check rate limit
            profile_id_uuid = (
                uuid.UUID(context["profile_id"]) if context["profile_id"] else None
            )
            if not profile_id_uuid:
                raise ValueError("Profile not found. Please contact support.")

            req_per_day = context["req_per_day"]
            runs_today_count = context["runs_today_count"]

            if req_per_day is not None and runs_today_count >= req_per_day:
                from datetime import timedelta
                from zoneinfo import ZoneInfo

                earliest_run_created_at = context["earliest_run_created_at"]
                if earliest_run_created_at:
                    next_allowed_utc = earliest_run_created_at + timedelta(days=1)
                    eastern_tz = ZoneInfo("America/New_York")
                    next_allowed_et = next_allowed_utc.astimezone(eastern_tz)
                    error_message = (
                        f"Daily request limit of {req_per_day} reached. "
                        f"Next request allowed after {next_allowed_et.strftime('%I:%M %p %Z')} on "
                        f"{next_allowed_et.strftime('%B %d, %Y')}."
                    )
                else:
                    error_message = f"Daily request limit of {req_per_day} reached. Please try again tomorrow."
                raise ValueError(error_message)

            # Build hint agent from context
            profile_id_str = context.get("profile_id")
            hint_tools = create_hint_tools(
                profile_id=str(profile_id_str) if profile_id_str else None,
                primary_id=str(chat_id),
            )
            hint_agent = build_hint_agent(context, hint_tools)

            # Create model run with all junction records using SQL file
            sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
            model_run_row = await conn.fetchrow(
                sql_create_run,
                str(department_id),
                context["model_id"],
                context["agent_id"],
                "agent",
                context["profile_id"],
                None,  # key_id
                str(context["agent_id"]),  # agent_id
            )
            model_run_id = uuid.UUID(model_run_row["run_id"])

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

            # Extract hints from request-scoped storage
            profile_id_str = context.get("profile_id")
            if profile_id_str:
                storage = get_hint_storage()
                storage_key = build_storage_key(
                    operation_type="hint_generation",
                    profile_id=str(profile_id_str),
                    primary_id=str(chat_id),
                )
                hint_result = await storage.get_all(storage_key)
                hint_1 = hint_result.get("hint_1", "")
                hint_2 = hint_result.get("hint_2", "")
                hint_3 = hint_result.get("hint_3", "")
            else:
                hint_1 = ""
                hint_2 = ""
                hint_3 = ""

            # Log what was generated
            hints_generated = sum([bool(hint_1), bool(hint_2), bool(hint_3)])
            logger.info(f"Generated {hints_generated}/3 hints")

            if hints_generated < 3:
                logger.warning(
                    f"Not all hints were generated for message {message_id}. "
                    f"Got: hint_1={bool(hint_1)}, hint_2={bool(hint_2)}, hint_3={bool(hint_3)}"
                )

            # Create SimulationHints records using direct SQL
            hint_ids: list[dict[str, Any]] = []
            hints_for_event: list[HintItem] = []
            for i, hint_text in enumerate([hint_1, hint_2, hint_3], 1):
                if hint_text:  # Only save non-empty hints
                    # Get the next idx for this message
                    sql_max_idx = """
                        SELECT COALESCE(MAX(idx), -1) + 1 as next_idx
                        FROM simulation_hints
                        WHERE simulation_message_id = $1::uuid
                    """
                    max_idx_row = await conn.fetchrow(sql_max_idx, str(message_id))
                    next_idx = max_idx_row["next_idx"] if max_idx_row else 0

                    # Insert the hint
                    sql_insert = """
                        WITH inserted AS (
                            INSERT INTO simulation_hints (simulation_message_id, idx, hint)
                            VALUES ($1::uuid, $2::integer, $3::text)
                            RETURNING simulation_message_id, idx
                        )
                        SELECT 
                            simulation_message_id::text as simulation_message_id,
                            idx::integer as idx
                        FROM inserted
                    """
                    hint_result_row = await conn.fetchrow(
                        sql_insert, str(message_id), next_idx, hint_text
                    )
                    hint_result = {
                        "simulation_message_id": hint_result_row[
                            "simulation_message_id"
                        ],
                        "idx": hint_result_row["idx"],
                    }
                    hint_ids.append(hint_result)
                    # Store hint text for event emission
                    hints_for_event.append(
                        HintItem(
                            idx=hint_result_row["idx"],
                            hint=hint_text,
                        )
                    )
                    logger.info(
                        f"Created hint {i} (idx={hint_result['idx']}): {hint_text[:80]}..."
                    )

            logger.info(
                f"Successfully generated {len(hint_ids)} hints for message {message_id} "
                f"in chat {chat_id}"
            )

            # Emit completion event
            await hint_generation_progress(
                HintGenerationProgressPayload(
                    type="complete",
                    message="Hint generation completed successfully",
                    chat_id=str(chat_id),
                    message_id=str(message_id),
                    hint_ids=[
                        f"{h['simulation_message_id']}_{h['idx']}" for h in hint_ids
                    ],
                    hints_count=len(hint_ids),
                    hints=hints_for_event,
                ),
                room=f"simulation_{chat_id}",
            )

            logger.info(
                f"Background hint generation completed: {len(hint_ids)} hints created"
            )
        except Exception as e:
            logger.error(
                f"Background hint generation failed for message {message_id}: {e}",
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
                await hint_generation_progress(
                    HintGenerationProgressPayload(
                        type="error",
                        message=f"Hint generation failed: {str(emit_err)}",
                        error=str(emit_err),
                        chat_id=str(chat_id),
                        message_id=str(message_id),
                    ),
                    room=f"simulation_{chat_id}",
                )


async def _simulation_text_send_impl(
    sid: str, data: SendSimulationMessagePayload
) -> None:
    """Handle simulation message sending requests"""
    try:
        chat_id = data.chat_id
        message = data.message
        is_retry = data.is_retry
        # Note: assistant_audio_enabled and sketch_data not in payload model yet
        # These may need to be added if they're required
        assistant_audio_enabled = False
        sketch_data = None

        if not chat_id or (not message and not sketch_data):
            logger.error(
                f"Missing chat_id or both message and sketch_data in request from {sid}"
            )
            return

        logger.info(
            f"Processing simulation_text_send from {sid}: {chat_id} (audio: {assistant_audio_enabled}, sketch: {sketch_data is not None})"
        )

        # Process the message via WebSocket
        chat_id_uuid = uuid.UUID(chat_id)
        message_str = message or ""

        # Get connection pool
        pool = get_pool()
        if not pool:
            raise ValueError("Database connection pool not available")

        async with pool.acquire() as conn:
            try:
                # 1. Get or create a run for this chat (needed for message creation)
                # We'll get the run details from context later, but for now we need a run_id
                # For user messages, we'll use the latest run or create one
                sql_get_run = load_sql(
                    "sql/v3/simulations/get_or_create_run_for_chat.sql"
                )
                # We need context to create a run, so we'll get it first
                # For now, get the latest run for the chat's group
                latest_run_row = await conn.fetchrow(
                    """
                    SELECT gr.run_id::text as run_id
                    FROM chat_messages cm
                    JOIN message_runs mr ON mr.message_id = cm.message_id
                    JOIN group_runs gr ON gr.run_id = mr.run_id
                    JOIN runs r ON r.id = gr.run_id
                    WHERE cm.chat_id = $1::uuid
                    ORDER BY r.created_at DESC
                    LIMIT 1
                    """,
                    str(chat_id_uuid),
                )

                # 1. Add the user message to the chat (skip if this is a retry)
                user_message = None
                if message_str and message_str.strip() != "" and not is_retry:
                    # If no run exists yet, we'll create one later when we have context
                    # For now, we need to get or create a run
                    if not latest_run_row:
                        # We'll create the run later when we have full context
                        # For now, skip message creation and create it after run creation
                        pass
                    else:
                        run_id_for_message = latest_run_row["run_id"]
                        # Create message without run_id
                        sql = load_sql("sql/v3/simulations/create_message.sql")
                        user_message_row = await conn.fetchrow(
                            sql, "user", message_str, True, None
                        )
                        user_message = {
                            "id": user_message_row["id"],
                            "created_at": user_message_row["created_at"],
                        }
                        # Link message to run via message_runs
                        sql_link = load_sql(
                            "sql/v3/simulations/link_message_to_run.sql"
                        )
                        await conn.execute(
                            sql_link,
                            str(user_message["id"]),
                            run_id_for_message,
                        )

                        # Create branch from latest message to new user message (if latest exists)
                        sql_latest = load_sql(
                            "sql/v3/simulations/get_latest_message.sql"
                        )
                        latest_message_row = await conn.fetchrow(
                            sql_latest, str(chat_id_uuid)
                        )
                        if latest_message_row:
                            latest_id_str = str(latest_message_row["id"])
                            user_id_str = str(user_message["id"])
                            # Prevent self-references (parent_id != child_id)
                            if latest_id_str != user_id_str:
                                sql_branch = load_sql(
                                    "sql/v3/simulations/create_message_branch.sql"
                                )
                                await conn.execute(
                                    sql_branch,
                                    latest_id_str,
                                    user_id_str,
                                )
                                logger.info(
                                    f"Created branch from message {latest_id_str} to user message {user_id_str}"
                                )
                            else:
                                logger.warning(
                                    f"Skipping branch creation: latest message ID ({latest_id_str}) equals user message ID ({user_id_str})"
                                )

                        # 2. Emit user message to connected clients
                        logger.info(
                            f"Emitting user message to room simulation_{chat_id_uuid}"
                        )
                        await simulation_new_message(
                            SimulationNewMessagePayload(
                                message_id=str(user_message["id"]),
                                chat_id=str(chat_id_uuid),
                                role="user",
                                content=message_str,
                                completed=True,
                                created_at=user_message["created_at"].isoformat(),
                            ),
                            room=f"simulation_{chat_id_uuid}",
                        )
                        # Emit message_sent event for tour progression and cross-component communication
                        await message_sent(
                            MessageSentPayload(
                                message_id=str(user_message["id"]),
                                chat_id=str(chat_id_uuid),
                                message=message_str,
                                created_at=user_message["created_at"].isoformat(),
                            ),
                            room=f"simulation_{chat_id_uuid}",
                        )
                else:
                    if is_retry:
                        logger.info(
                            f"Skipping user message creation for retry in chat {chat_id_uuid}"
                        )

                logger.info(f"Processing simulation message for chat {chat_id_uuid}")

                # 5. Stream the assistant response (inlined run_simulation_agent)
                cancelled = False

                try:
                    # Cooperative cancellation support using Redis flags
                    # We poll for a cancellation flag bound to this chat's active run ID
                    from app.utils.websocket.store_active_run import store_active_run

                    # Fetch context for the chat
                    sql_context = load_sql(
                        "sql/v3/agents/get_simulation_run_context.sql"
                    )
                    context_row = await conn.fetchrow(sql_context, str(chat_id_uuid))
                    if not context_row:
                        raise ValueError(
                            f"Chat {chat_id_uuid} not found or no persona configured"
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
                        "req_per_day": context_row["req_per_day"],
                        "runs_today_count": context_row["runs_today_count"],
                        "earliest_run_created_at": context_row[
                            "earliest_run_created_at"
                        ],
                    }

                    # Validate API key before proceeding
                    if not context.get("api_key"):
                        error_msg = (
                            f"API key not configured for provider '{context.get('provider_name', 'unknown')}' "
                            f"in settings. Model: {context.get('model_name', 'unknown')}, "
                            f"Persona: {context.get('persona_name', 'unknown')}. "
                            f"Please configure a provider key in settings."
                        )
                        await simulation_text_send_error(
                            SendSimulationMessageErrorPayload(
                                success=False,
                                message=error_msg,
                            ),
                            room=sid,
                        )
                        logger.error(
                            f"Missing API key for chat {chat_id_uuid}: {error_msg}"
                        )
                        return

                    # Extract department_id from context
                    # SQL query includes fallback: scenario -> profile -> any active department
                    # department_id should always be present due to SQL fallback logic
                    # but handle edge case where no departments exist in system
                    department_id_str = context.get("department_id")
                    if not department_id_str:
                        await simulation_text_send_error(
                            SendSimulationMessageErrorPayload(
                                success=False,
                                message="No active departments found in system",
                            ),
                            room=sid,
                        )
                        logger.error(
                            f"Emitted error to {sid}: No active departments found in system for chat {chat_id_uuid}"
                        )
                        return

                    department_id = uuid.UUID(str(department_id_str))

                    input_items: list[TResponseInputItem] = []

                    # Format document info if documents are available
                    if context["documents"]:
                        document_info = format_document_info(
                            context["documents"], context["image_input_active"]
                        )
                        input_items.append(document_info)

                    # Get all messages using SQL file
                    sql_messages = load_sql(
                        "sql/v3/simulations/get_simulation_messages.sql"
                    )
                    message_rows = await conn.fetch(sql_messages, str(chat_id_uuid))
                    messages = [dict(row) for row in message_rows]

                    # Prepare conversation history from chat_id
                    conversation_history = get_simulation_conversation_history(messages)

                    # Format chat scenario using the problem statement from context
                    chat_scenario = format_chat_scenario(context["problem_statement"])

                    input_items.insert(0, chat_scenario)
                    input_items.extend(conversation_history)

                    # Check rate limit
                    profile_id_uuid = (
                        uuid.UUID(context["profile_id"])
                        if context["profile_id"]
                        else None
                    )
                    if not profile_id_uuid:
                        raise ValueError("Profile not found. Please contact support.")

                    req_per_day = context["req_per_day"]
                    runs_today_count = context["runs_today_count"]

                    if req_per_day is not None and runs_today_count >= req_per_day:
                        from datetime import timedelta
                        from zoneinfo import ZoneInfo

                        earliest_run_created_at = context["earliest_run_created_at"]
                        if earliest_run_created_at:
                            next_allowed_utc = earliest_run_created_at + timedelta(
                                days=1
                            )
                            eastern_tz = ZoneInfo("America/New_York")
                            next_allowed_et = next_allowed_utc.astimezone(eastern_tz)
                            error_message = (
                                f"Daily request limit of {req_per_day} reached. "
                                f"Next request allowed after {next_allowed_et.strftime('%I:%M %p %Z')} on "
                                f"{next_allowed_et.strftime('%B %d, %Y')}."
                            )
                        else:
                            error_message = f"Daily request limit of {req_per_day} reached. Please try again tomorrow."
                        raise ValueError(error_message)

                    # Get Simulation Text Agent ID from context (already available from get_simulation_run_context.sql)
                    # After migration 97, agents are on simulations (simulation_text_agent_id), not personas
                    simulation_agent_id = context_row.get("agent_id")
                    if not simulation_agent_id:
                        raise ValueError(
                            f"Simulation Text Agent not found for simulation {context['simulation_id']}"
                        )

                    # Create model run with all junction records using SQL file (using persona, not agent)
                    sql_create_run = load_sql(
                        "sql/v3/model_runs/create_model_run_complete.sql"
                    )
                    model_run_row = await conn.fetchrow(
                        sql_create_run,
                        context["department_id"],
                        context["model_id"],
                        context["persona_id"],
                        "persona",
                        context["profile_id"],
                        None,  # key_id
                        str(simulation_agent_id),  # agent_id
                    )
                    model_run_id = uuid.UUID(model_run_row["run_id"])

                    # Link run to chat if not already linked
                    await conn.execute(
                        """
                        INSERT INTO chat_runs (run_id, chat_id, created_at, updated_at)
                        VALUES ($1::uuid, $2::uuid, NOW(), NOW())
                        ON CONFLICT (run_id, chat_id) DO NOTHING
                        """,
                        str(model_run_id),
                        str(chat_id_uuid),
                    )

                    # Link system/developer messages to run
                    sql_link_sys_dev = load_sql(
                        "sql/v3/model_runs/link_system_developer_messages_to_run.sql"
                    )
                    await conn.fetchrow(
                        sql_link_sys_dev,
                        str(model_run_id),
                        context.get("department_id"),
                        str(chat_id_uuid),
                    )

                    # Create user message if it wasn't created earlier (no run existed)
                    if (
                        not user_message
                        and message_str
                        and message_str.strip() != ""
                        and not is_retry
                    ):
                        # Create message without run_id
                        sql = load_sql("sql/v3/simulations/create_message.sql")
                        user_message_row = await conn.fetchrow(
                            sql, "user", message_str, True, None
                        )
                        user_message = {
                            "id": user_message_row["id"],
                            "created_at": user_message_row["created_at"],
                        }
                        # Link message to run via message_runs
                        sql_link = load_sql(
                            "sql/v3/simulations/link_message_to_run.sql"
                        )
                        await conn.execute(
                            sql_link,
                            str(user_message["id"]),
                            str(model_run_id),
                        )
                        # Link to message_tree: developer → user (or system → user if no developer)
                        # Get system/developer messages for this run
                        sys_dev_result = await conn.fetchrow(
                            sql_link_sys_dev,
                            str(model_run_id),
                            context.get("department_id"),
                            str(chat_id_uuid),
                        )
                        if sys_dev_result and user_message:
                            dev_msg_id = sys_dev_result.get("developer_message_id")
                            sys_msg_id = sys_dev_result.get("system_message_id")
                            user_msg_id = str(user_message["id"])
                            # Link developer → user (if developer exists and IDs are different)
                            if dev_msg_id and str(dev_msg_id) != user_msg_id:
                                sql_branch = load_sql(
                                    "sql/v3/simulations/create_message_branch.sql"
                                )
                                await conn.execute(
                                    sql_branch,
                                    str(dev_msg_id),
                                    user_msg_id,
                                )
                            # Link system → user (if system exists, no developer, and IDs are different)
                            elif sys_msg_id and str(sys_msg_id) != user_msg_id:
                                sql_branch = load_sql(
                                    "sql/v3/simulations/create_message_branch.sql"
                                )
                                await conn.execute(
                                    sql_branch,
                                    str(sys_msg_id),
                                    user_msg_id,
                                )

                    # Get all personas for this scenario and create persona tools
                    sql_personas = load_sql("sql/v3/voice/get_chat_personas.sql")
                    persona_rows = await conn.fetch(sql_personas, str(chat_id_uuid))
                    personas = [dict(row) for row in persona_rows]

                    # Track parent message for branching (user message or latest)
                    parent_message_id_for_branching: uuid.UUID | None = None
                    if is_retry:
                        # For retry: branch from previous user message
                        sql_prev_user = load_sql(
                            "sql/v3/simulations/get_previous_user_message.sql"
                        )
                        prev_user_row = await conn.fetchrow(
                            sql_prev_user, str(chat_id_uuid)
                        )
                        if prev_user_row:
                            parent_message_id_for_branching = prev_user_row["id"]
                            logger.info(
                                f"Retry: will branch tool call messages from previous user message {parent_message_id_for_branching}"
                            )
                    else:
                        # For normal flow: branch from user message just created (or latest if no user message)
                        if user_message:
                            parent_message_id_for_branching = user_message["id"]
                        else:
                            # Fallback: use latest message (shouldn't happen in normal flow)
                            sql_latest = load_sql(
                                "sql/v3/simulations/get_latest_message.sql"
                            )
                            latest_message_row = await conn.fetchrow(
                                sql_latest, str(chat_id_uuid)
                            )
                            if latest_message_row:
                                parent_message_id_for_branching = latest_message_row[
                                    "id"
                                ]

                    # Create emit function wrappers for persona tools
                    async def emit_new_message_wrapper(
                        event_data: dict[str, Any],
                    ) -> None:
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

                    # Track completed tool messages for hint generation
                    completed_tool_messages: list[dict[str, Any]] = []

                    # Create wrapper that tracks completed messages
                    async def emit_complete_with_tracking(
                        event_data: dict[str, Any],
                    ) -> None:
                        await emit_complete_wrapper(event_data)
                        # Track completed message for hint generation
                        completed_tool_messages.append(
                            {"id": uuid.UUID(event_data["message_id"])}
                        )

                    # Create persona tools if personas exist
                    persona_tools = []
                    if personas:
                        persona_tools = create_persona_tools(
                            personas,
                            chat_id_uuid,
                            conn,
                            model_run_id,
                            emit_new_message_wrapper,
                            emit_token_wrapper,
                            emit_complete_with_tracking,
                            parent_message_id_for_branching,
                        )
                        logger.info(
                            f"Created {len(persona_tools)} persona tools for chat {chat_id_uuid}"
                        )

                        # Get persona instructions for developer message
                        sql_get_persona_instructions = load_sql(
                            "sql/v3/voice/get_persona_instructions.sql"
                        )
                        persona_instruction_rows = await conn.fetch(
                            sql_get_persona_instructions,
                            str(chat_id_uuid),
                        )

                        # Build map of persona_name -> instructions
                        persona_instructions_map: dict[str, str] = {}
                        for row in persona_instruction_rows:
                            persona_name = row.get("persona_name", "")
                            instructions = row.get("instructions", "")
                            if persona_name:
                                persona_instructions_map[persona_name] = (
                                    instructions or ""
                                )

                        # Build developer message with persona instructions
                        persona_names = [
                            p.get("persona_name") or p.get("name", "Unknown")
                            for p in personas
                        ]
                        persona_descriptions = []
                        for persona_name in persona_names:
                            instructions = persona_instructions_map.get(
                                persona_name, ""
                            )
                            if instructions:
                                persona_descriptions.append(
                                    f"- {persona_name}: {instructions}"
                                )
                            else:
                                persona_descriptions.append(f"- {persona_name}")

                        # Build list of available persona names for tool usage
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

                        # Add debug_info tool to persona_tools
                        from app.utils.debug_info import debug_info

                        persona_tools.append(debug_info)

                    # Create agent instance using context data with persona tools
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

                    # Link run to chat if not already linked
                    await conn.execute(
                        """
                        INSERT INTO chat_runs (run_id, chat_id, created_at, updated_at)
                        VALUES ($1::uuid, $2::uuid, NOW(), NOW())
                        ON CONFLICT (run_id, chat_id) DO NOTHING
                        """,
                        str(model_run_id),
                        str(chat_id_uuid),
                    )

                    # Link system/developer messages to run
                    sql_link_sys_dev = load_sql(
                        "sql/v3/model_runs/link_system_developer_messages_to_run.sql"
                    )
                    await conn.fetchrow(
                        sql_link_sys_dev,
                        str(model_run_id),
                        context.get("department_id"),
                        str(chat_id_uuid),
                    )

                    # Create user message if it wasn't created earlier (no run existed)
                    if (
                        not user_message
                        and message_str
                        and message_str.strip() != ""
                        and not is_retry
                    ):
                        # Create message without run_id
                        sql = load_sql("sql/v3/simulations/create_message.sql")
                        user_message_row = await conn.fetchrow(
                            sql, "user", message_str, True, None
                        )
                        user_message = {
                            "id": user_message_row["id"],
                            "created_at": user_message_row["created_at"],
                        }
                        # Link message to run via message_runs
                        sql_link = load_sql(
                            "sql/v3/simulations/link_message_to_run.sql"
                        )
                        await conn.execute(
                            sql_link,
                            str(user_message["id"]),
                            str(model_run_id),
                        )
                        # Link to message_tree: developer → user (or system → user if no developer)
                        # Get system/developer messages for this run
                        sys_dev_result = await conn.fetchrow(
                            sql_link_sys_dev,
                            str(model_run_id),
                            context.get("department_id"),
                            str(chat_id_uuid),
                        )
                        if sys_dev_result and user_message:
                            dev_msg_id = sys_dev_result.get("developer_message_id")
                            sys_msg_id = sys_dev_result.get("system_message_id")
                            user_msg_id = str(user_message["id"])
                            # Link developer → user (if developer exists and IDs are different)
                            if dev_msg_id and str(dev_msg_id) != user_msg_id:
                                sql_branch = load_sql(
                                    "sql/v3/simulations/create_message_branch.sql"
                                )
                                await conn.execute(
                                    sql_branch,
                                    str(dev_msg_id),
                                    user_msg_id,
                                )
                            # Link system → user (if system exists, no developer, and IDs are different)
                            elif sys_msg_id and str(sys_msg_id) != user_msg_id:
                                sql_branch = load_sql(
                                    "sql/v3/simulations/create_message_branch.sql"
                                )
                                await conn.execute(
                                    sql_branch,
                                    str(sys_msg_id),
                                    user_msg_id,
                                )

                    # Get tool calls tracking dict for this chat
                    tool_calls_dict = get_simulation_tool_calls_dict()
                    chat_id_str = str(chat_id_uuid)
                    if chat_id_str not in tool_calls_dict:
                        tool_calls_dict[chat_id_str] = {}

                    # Track fake_id -> real_id mapping and counter for unique IDs
                    fake_id_to_real_id: dict[str, str] = {}
                    tool_call_counter = 0

                    with trace(
                        context["chat_title"],
                        trace_id=context["trace_id"],
                        group_id=context["attempt_id"],
                    ):
                        result = Runner.run_streamed(
                            agent_instance.agent(),
                            input=input_items,
                            context=DebugContext(conn=conn, run_id=model_run_id),
                        )

                    # Store the result in active runs for potential cancellation

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
                                    # Check if this is a function call item
                                    item_type = (
                                        getattr(item, "type", None)
                                        if hasattr(item, "type")
                                        else None
                                    )
                                    if item_type == "function_call":
                                        # Get tool call ID and name from the item
                                        item_id = getattr(item, "id", None)
                                        tool_name = getattr(item, "name", None)

                                        if item_id and tool_name:
                                            # Initialize tool call state if not exists
                                            if (
                                                item_id
                                                not in tool_calls_dict[chat_id_str]
                                            ):
                                                tool_calls_dict[chat_id_str][
                                                    item_id
                                                ] = {
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
                                                # Update name if we didn't have it yet
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

                                # Check if this is a function call arguments delta event
                                event_data_type = (
                                    getattr(event_data, "type", None)
                                    if hasattr(event_data, "type")
                                    else None
                                )

                                # Handle response.output_item.added to get tool name and item_id
                                if event_data_type == "response.output_item.added":
                                    # Extract item information from the added event
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
                                            # Try to get call_id from item (this is the unique identifier we want to use)
                                            call_id = getattr(item, "call_id", None)

                                            # Also try to get item_id from event_data directly if not in item
                                            if not fake_item_id:
                                                fake_item_id = getattr(
                                                    event_data, "item_id", None
                                                )

                                            # Use call_id as the unique identifier if available, otherwise generate one
                                            if call_id:
                                                real_item_id = call_id
                                            elif fake_item_id:
                                                # Fallback: generate unique ID if call_id not available
                                                tool_call_counter += 1
                                                real_item_id = f"{chat_id_str}_{tool_call_counter}_{uuid.uuid4().hex[:8]}"
                                            else:
                                                logger.error(
                                                    "output_item.added: missing both call_id and item_id"
                                                )
                                                continue

                                            if tool_name:
                                                # Map fake_id to real_id for delta events (they use fake_id)
                                                if fake_item_id:
                                                    fake_id_to_real_id[fake_item_id] = (
                                                        real_item_id
                                                    )

                                                # Check if this call_id already exists (prevent duplicates)
                                                if (
                                                    real_item_id
                                                    in tool_calls_dict[chat_id_str]
                                                ):
                                                    continue

                                                # Check if state already exists (from deltas that arrived first)
                                                if (
                                                    real_item_id
                                                    in tool_calls_dict[chat_id_str]
                                                ):
                                                    # Update the name and process accumulated arguments
                                                    existing_state = tool_calls_dict[
                                                        chat_id_str
                                                    ][real_item_id]
                                                    existing_state["name"] = tool_name
                                                    existing_state["call_id"] = call_id

                                                    # Process accumulated arguments if any
                                                    if existing_state["arguments_raw"]:
                                                        accumulated_raw = (
                                                            existing_state[
                                                                "arguments_raw"
                                                            ]
                                                        )

                                                        # Extract persona
                                                        if not existing_state[
                                                            "persona_so_far"
                                                        ]:
                                                            persona = extract_persona_from_json(
                                                                accumulated_raw
                                                            )
                                                            if persona:
                                                                existing_state[
                                                                    "persona_so_far"
                                                                ] = persona

                                                        # Extract message content
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
                                                    # Initialize tool call state with call_id as the key
                                                    tool_calls_dict[chat_id_str][
                                                        real_item_id
                                                    ] = {
                                                        "name": tool_name,
                                                        "response_id": real_item_id,
                                                        "call_id": call_id,  # Store the actual call_id
                                                        "fake_id": fake_item_id,  # Keep track of fake_id for mapping
                                                        "arguments_raw": "",
                                                        "message_so_far": "",
                                                        "persona_so_far": None,
                                                        "db_message_id": None,
                                                        "last_processed_index": 0,
                                                        "in_message": False,
                                                        "parent_message_id": parent_message_id_for_branching,
                                                        "completed": False,
                                                    }
                                            else:
                                                logger.warning(
                                                    f"output_item.added: missing tool_name: call_id={call_id}, item_id={fake_item_id}"
                                                )

                                if (
                                    event_data_type
                                    == "response.function_call_arguments.delta"
                                ):
                                    # This is a ResponseFunctionCallArgumentsDeltaEvent
                                    # It has: delta (str), item_id (str) - item_id is the fake_id
                                    # Also check for call_id in event_data
                                    fake_item_id = getattr(event_data, "item_id", None)
                                    arguments_delta = getattr(event_data, "delta", None)

                                    # Try to get call_id from event_data (might be available)
                                    call_id = getattr(event_data, "call_id", None)

                                    if not arguments_delta:
                                        continue

                                    # Determine the real_id: prefer call_id, then mapped fake_id, then wait
                                    if call_id:
                                        # Use call_id directly if available
                                        delta_real_item_id = call_id
                                    elif fake_item_id:
                                        # Map fake_id to real_id (from output_item.added)
                                        delta_real_item_id = fake_id_to_real_id.get(
                                            fake_item_id
                                        )
                                        if not delta_real_item_id:
                                            # If we haven't seen this fake_id before, wait for output_item.added
                                            # Don't generate a new ID here - wait for the added event
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

                                    # Use delta_real_item_id as the tool_call_id for tracking
                                    tool_call_id = delta_real_item_id  # type: ignore[assignment]

                                    # Get or create tool call state
                                    if tool_call_id not in tool_calls_dict[chat_id_str]:
                                        # First delta for this tool call - create state (name will be set from output_item.added)
                                        tool_calls_dict[chat_id_str][tool_call_id] = {
                                            "name": None,  # Will be set when we get tool name from output_item.added
                                            "response_id": str(tool_call_id),
                                            "arguments_raw": "",
                                            "message_so_far": "",
                                            "persona_so_far": None,
                                            "db_message_id": None,
                                            "last_processed_index": 0,
                                            "in_message": False,
                                            "parent_message_id": parent_message_id_for_branching,
                                            "completed": False,
                                        }

                                    tool_call_state = tool_calls_dict[chat_id_str][
                                        tool_call_id
                                    ]

                                    # Skip if we don't know the tool name yet (wait for output_item.added)
                                    if tool_call_state["name"] is None:
                                        # Just accumulate arguments for now
                                        tool_call_state["arguments_raw"] += (
                                            arguments_delta
                                        )
                                        continue

                                    # Only process "speak" tool calls
                                    if tool_call_state["name"] != "speak":
                                        continue

                                    # Append arguments delta
                                    prev_raw = tool_call_state["arguments_raw"]
                                    tool_call_state["arguments_raw"] += arguments_delta
                                    new_raw = tool_call_state["arguments_raw"]

                                    # Extract persona if available
                                    if not tool_call_state["persona_so_far"]:
                                        persona = extract_persona_from_json(new_raw)
                                        if persona:
                                            tool_call_state["persona_so_far"] = persona

                                    # Extract new message content incrementally
                                    new_message_chars, new_index, in_message = (
                                        extract_new_message_chars(
                                            prev_raw,
                                            new_raw,
                                            tool_call_state["last_processed_index"],
                                        )
                                    )
                                    tool_call_state["last_processed_index"] = new_index
                                    tool_call_state["in_message"] = in_message

                                    if new_message_chars:
                                        tool_call_state["message_so_far"] += (
                                            new_message_chars
                                        )

                                        # Create DB message if not created yet
                                        if tool_call_state["db_message_id"] is None:
                                            sql_create_message = load_sql(
                                                "sql/v3/simulations/create_message.sql"
                                            )
                                            assistant_message_row = await conn.fetchrow(
                                                sql_create_message,
                                                "assistant",
                                                "",
                                                False,
                                                None,
                                            )
                                            db_message_id = assistant_message_row["id"]
                                            tool_call_state["db_message_id"] = (
                                                db_message_id
                                            )

                                            # Link message to run
                                            sql_link = load_sql(
                                                "sql/v3/simulations/link_message_to_run.sql"
                                            )
                                            await conn.execute(
                                                sql_link,
                                                str(db_message_id),
                                                str(model_run_id),
                                            )

                                            # Link to persona if we have it
                                            if tool_call_state["persona_so_far"]:
                                                persona_match = find_persona_by_name(
                                                    tool_call_state["persona_so_far"],
                                                    personas,
                                                )
                                                if persona_match:
                                                    persona_id, _ = persona_match
                                                    sql_link_persona = load_sql(
                                                        "sql/v3/simulations/link_message_to_persona.sql"
                                                    )
                                                    try:
                                                        await conn.execute(
                                                            sql_link_persona,
                                                            str(db_message_id),
                                                            str(persona_id),
                                                        )
                                                    except Exception as link_err:
                                                        logger.warning(
                                                            f"Failed to link message to persona: {link_err}"
                                                        )

                                            # Create branch if parent exists
                                            if tool_call_state["parent_message_id"]:
                                                parent_id_str = str(
                                                    tool_call_state["parent_message_id"]
                                                )
                                                assistant_id_str = str(db_message_id)
                                                if parent_id_str != assistant_id_str:
                                                    sql_branch = load_sql(
                                                        "sql/v3/simulations/create_message_branch.sql"
                                                    )
                                                    await conn.execute(
                                                        sql_branch,
                                                        parent_id_str,
                                                        assistant_id_str,
                                                    )

                                            # Emit new message event
                                            persona_id_str = None
                                            if tool_call_state["persona_so_far"]:
                                                persona_match = find_persona_by_name(
                                                    tool_call_state["persona_so_far"],
                                                    personas,
                                                )
                                                if persona_match:
                                                    persona_id_str = str(
                                                        persona_match[0]
                                                    )

                                            await simulation_new_message(
                                                SimulationNewMessagePayload(
                                                    message_id=str(db_message_id),
                                                    chat_id=chat_id_str,
                                                    role="assistant",
                                                    content="",
                                                    completed=False,
                                                    created_at=assistant_message_row[
                                                        "created_at"
                                                    ].isoformat(),
                                                    persona_id=persona_id_str,
                                                ),
                                                room=f"simulation_{chat_id_uuid}",
                                            )

                                        # Update DB with accumulated content
                                        sql_update = load_sql(
                                            "sql/v3/simulations/update_message_content.sql"
                                        )
                                        await conn.execute(
                                            sql_update,
                                            tool_call_state["message_so_far"],
                                            str(tool_call_state["db_message_id"]),
                                        )

                                        # Emit token event
                                        await simulation_message_token(
                                            SimulationMessageTokenPayload(
                                                message_id=str(
                                                    tool_call_state["db_message_id"]
                                                ),
                                                chat_id=chat_id_str,
                                                token=new_message_chars,
                                                accumulated_content=tool_call_state[
                                                    "message_so_far"
                                                ],
                                            ),
                                            room=f"simulation_{chat_id_uuid}",
                                        )

                            # Check for tool call completion via raw_response_event with output_item.done
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
                                        # Get item_id from the done event (this will be fake_id)
                                        fake_item_id = getattr(
                                            event_data, "item_id", None
                                        )
                                        # Try to get call_id from event_data or item
                                        item = getattr(event_data, "item", None)
                                        call_id = None
                                        if item:
                                            call_id = getattr(item, "call_id", None)
                                        if not call_id:
                                            call_id = getattr(
                                                event_data, "call_id", None
                                            )

                                        # Prefer call_id, fallback to mapped fake_id
                                        if call_id:
                                            done_real_item_id = call_id
                                        elif fake_item_id:
                                            done_real_item_id = fake_id_to_real_id.get(
                                                fake_item_id
                                            )
                                        else:
                                            # Log more details about the event to understand what's missing
                                            logger.warning(
                                                f"Completion event has no call_id or item_id. "
                                                f"event_data keys: {dir(event_data) if event_data else None}, "
                                                f"item keys: {dir(item) if item else None}"
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
                                            tool_call_id = done_real_item_id  # type: ignore[assignment]
                                            tool_call_state = tool_calls_dict[
                                                chat_id_str
                                            ][tool_call_id]

                                            # Only process "speak" tool calls
                                            if tool_call_state.get("name") != "speak":
                                                continue

                                            # Check if already completed (prevent double-processing)
                                            if tool_call_state.get("completed"):
                                                continue

                                            tool_call_state["completed"] = True

                                            # Parse final JSON arguments and complete
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

                                                # Update final content
                                                tool_call_state["message_so_far"] = (
                                                    final_message
                                                )
                                                if (
                                                    final_persona
                                                    and not tool_call_state[
                                                        "persona_so_far"
                                                    ]
                                                ):
                                                    tool_call_state[
                                                        "persona_so_far"
                                                    ] = final_persona

                                                db_message_id = tool_call_state[
                                                    "db_message_id"
                                                ]
                                                if db_message_id:
                                                    # Update DB with final content
                                                    sql_update = load_sql(
                                                        "sql/v3/simulations/update_message_content.sql"
                                                    )
                                                    await conn.execute(
                                                        sql_update,
                                                        final_message,
                                                        str(db_message_id),
                                                    )

                                                    # Complete message
                                                    sql_complete = load_sql(
                                                        "sql/v3/simulations/complete_message.sql"
                                                    )
                                                    await conn.execute(
                                                        sql_complete,
                                                        final_message,
                                                        str(db_message_id),
                                                    )

                                                    # Link to persona if we have it and haven't already
                                                    if final_persona:
                                                        persona_match = (
                                                            find_persona_by_name(
                                                                final_persona, personas
                                                            )
                                                        )
                                                        if persona_match:
                                                            persona_id, _ = (
                                                                persona_match
                                                            )
                                                            sql_link_persona = load_sql(
                                                                "sql/v3/simulations/link_message_to_persona.sql"
                                                            )
                                                            try:
                                                                await conn.execute(
                                                                    sql_link_persona,
                                                                    str(db_message_id),
                                                                    str(persona_id),
                                                                )
                                                            except Exception:
                                                                pass  # Already linked or error

                                                    # Emit completion event
                                                    await simulation_message_complete(
                                                        SimulationMessageCompletePayload(
                                                            message_id=str(
                                                                db_message_id
                                                            ),
                                                            chat_id=chat_id_str,
                                                            final_content=final_message,
                                                        ),
                                                        room=f"simulation_{chat_id_uuid}",
                                                    )

                                                    # Emit final message update
                                                    persona_id_str = None
                                                    if final_persona:
                                                        persona_match = (
                                                            find_persona_by_name(
                                                                final_persona, personas
                                                            )
                                                        )
                                                        if persona_match:
                                                            persona_id_str = str(
                                                                persona_match[0]
                                                            )

                                                    await simulation_new_message(
                                                        SimulationNewMessagePayload(
                                                            message_id=str(
                                                                db_message_id
                                                            ),
                                                            chat_id=chat_id_str,
                                                            role="assistant",
                                                            content=final_message,
                                                            completed=True,
                                                            created_at="",  # Will be updated from DB if needed
                                                            persona_id=persona_id_str,
                                                        ),
                                                        room=f"simulation_{chat_id_uuid}",
                                                    )

                                                    # Track completed tool messages for hint generation
                                                    completed_tool_messages.append(
                                                        {
                                                            "id": db_message_id,
                                                            "content": final_message,
                                                        }
                                                    )

                                                # Clean up tool call state
                                                del tool_calls_dict[chat_id_str][
                                                    tool_call_id
                                                ]

                                            except json.JSONDecodeError as e:
                                                logger.error(
                                                    f"Failed to parse final tool call arguments: {e}"
                                                )
                                                # Still try to complete with what we have
                                                if tool_call_state["db_message_id"]:
                                                    final_message = tool_call_state[
                                                        "message_so_far"
                                                    ]
                                                    sql_complete = load_sql(
                                                        "sql/v3/simulations/complete_message.sql"
                                                    )
                                                    await conn.execute(
                                                        sql_complete,
                                                        final_message,
                                                        str(
                                                            tool_call_state[
                                                                "db_message_id"
                                                            ]
                                                        ),
                                                    )
                                                    await simulation_message_complete(
                                                        SimulationMessageCompletePayload(
                                                            message_id=str(
                                                                tool_call_state[
                                                                    "db_message_id"
                                                                ]
                                                            ),
                                                            chat_id=chat_id_str,
                                                            final_content=final_message,
                                                        ),
                                                        room=f"simulation_{chat_id_uuid}",
                                                    )
                                                del tool_calls_dict[chat_id_str][
                                                    tool_call_id
                                                ]

                            # Check for tool call completion via run_item_stream_event with function_call_output
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
                                    if item_type == "function_call_output":
                                        # Tool call has completed - get the item_id (might be fake_id)
                                        fake_item_id = getattr(
                                            item, "id", None
                                        ) or getattr(item, "item_id", None)
                                        # Map fake_id to real_id, or use directly if already real_id
                                        output_real_item_id: str | None = (
                                            fake_id_to_real_id.get(
                                                fake_item_id, fake_item_id
                                            )
                                            if fake_item_id
                                            else None
                                        )  # type: ignore[assignment]
                                        if not output_real_item_id:
                                            logger.warning(
                                                f"Completion event for unknown fake_id={fake_item_id}"
                                            )
                                            continue
                                        if output_real_item_id in tool_calls_dict.get(
                                            chat_id_str, {}
                                        ):
                                            tool_call_id = output_real_item_id  # type: ignore[assignment]
                                            tool_call_state = tool_calls_dict[
                                                chat_id_str
                                            ][tool_call_id]

                                            # Only process "speak" tool calls
                                            if tool_call_state.get("name") != "speak":
                                                continue

                                            # Check if already completed (prevent double-processing)
                                            if tool_call_state.get("completed"):
                                                continue

                                            tool_call_state["completed"] = True

                                            # Parse final JSON arguments and complete
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

                                                # Update final content
                                                tool_call_state["message_so_far"] = (
                                                    final_message
                                                )
                                                if (
                                                    final_persona
                                                    and not tool_call_state[
                                                        "persona_so_far"
                                                    ]
                                                ):
                                                    tool_call_state[
                                                        "persona_so_far"
                                                    ] = final_persona

                                                db_message_id = tool_call_state[
                                                    "db_message_id"
                                                ]
                                                if db_message_id:
                                                    # Update DB with final content
                                                    sql_update = load_sql(
                                                        "sql/v3/simulations/update_message_content.sql"
                                                    )
                                                    await conn.execute(
                                                        sql_update,
                                                        final_message,
                                                        str(db_message_id),
                                                    )

                                                    # Complete message
                                                    sql_complete = load_sql(
                                                        "sql/v3/simulations/complete_message.sql"
                                                    )
                                                    await conn.execute(
                                                        sql_complete,
                                                        final_message,
                                                        str(db_message_id),
                                                    )

                                                    # Link to persona if we have it and haven't already
                                                    if final_persona:
                                                        persona_match = (
                                                            find_persona_by_name(
                                                                final_persona, personas
                                                            )
                                                        )
                                                        if persona_match:
                                                            persona_id, _ = (
                                                                persona_match
                                                            )
                                                            sql_link_persona = load_sql(
                                                                "sql/v3/simulations/link_message_to_persona.sql"
                                                            )
                                                            try:
                                                                await conn.execute(
                                                                    sql_link_persona,
                                                                    str(db_message_id),
                                                                    str(persona_id),
                                                                )
                                                            except Exception:
                                                                pass  # Already linked or error

                                                    # Emit completion event
                                                    await simulation_message_complete(
                                                        SimulationMessageCompletePayload(
                                                            message_id=str(
                                                                db_message_id
                                                            ),
                                                            chat_id=chat_id_str,
                                                            final_content=final_message,
                                                        ),
                                                        room=f"simulation_{chat_id_uuid}",
                                                    )

                                                    # Emit final message update
                                                    persona_id_str = None
                                                    if final_persona:
                                                        persona_match = (
                                                            find_persona_by_name(
                                                                final_persona, personas
                                                            )
                                                        )
                                                        if persona_match:
                                                            persona_id_str = str(
                                                                persona_match[0]
                                                            )

                                                    await simulation_new_message(
                                                        SimulationNewMessagePayload(
                                                            message_id=str(
                                                                db_message_id
                                                            ),
                                                            chat_id=chat_id_str,
                                                            role="assistant",
                                                            content=final_message,
                                                            completed=True,
                                                            created_at="",  # Will be updated from DB if needed
                                                            persona_id=persona_id_str,
                                                        ),
                                                        room=f"simulation_{chat_id_uuid}",
                                                    )

                                                    # Track completed tool messages for hint generation
                                                    completed_tool_messages.append(
                                                        {
                                                            "id": db_message_id,
                                                            "content": final_message,
                                                        }
                                                    )

                                                # Clean up tool call state
                                                del tool_calls_dict[chat_id_str][
                                                    tool_call_id
                                                ]

                                            except json.JSONDecodeError as e:
                                                logger.error(
                                                    f"Failed to parse final tool call arguments: {e}"
                                                )
                                                # Still try to complete with what we have
                                                if tool_call_state["db_message_id"]:
                                                    final_message = tool_call_state[
                                                        "message_so_far"
                                                    ]
                                                    sql_complete = load_sql(
                                                        "sql/v3/simulations/complete_message.sql"
                                                    )
                                                    await conn.execute(
                                                        sql_complete,
                                                        final_message,
                                                        str(
                                                            tool_call_state[
                                                                "db_message_id"
                                                            ]
                                                        ),
                                                    )
                                                    await simulation_message_complete(
                                                        SimulationMessageCompletePayload(
                                                            message_id=str(
                                                                tool_call_state[
                                                                    "db_message_id"
                                                                ]
                                                            ),
                                                            chat_id=chat_id_str,
                                                            final_content=final_message,
                                                        ),
                                                        room=f"simulation_{chat_id_uuid}",
                                                    )
                                                    del tool_calls_dict[chat_id_str][
                                                        tool_call_id
                                                    ]

                            # Also check for response.output_item.done event which indicates completion
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
                                        # Get item_id from the item in the event (might be fake_id)
                                        item = getattr(event_data, "item", None)
                                        if item:
                                            fake_item_id = (
                                                getattr(item, "id", None)
                                                or getattr(item, "item_id", None)
                                                or getattr(event_data, "item_id", None)
                                            )
                                            # Try to get call_id from item
                                            call_id = getattr(item, "call_id", None)
                                            if not call_id:
                                                call_id = getattr(
                                                    event_data, "call_id", None
                                                )

                                            # Prefer call_id, fallback to mapped fake_id
                                            if call_id:
                                                done2_real_item_id = call_id
                                            elif fake_item_id:
                                                done2_real_item_id = (
                                                    fake_id_to_real_id.get(fake_item_id)
                                                )
                                            else:
                                                logger.warning(
                                                    "Completion event has no call_id or item_id"
                                                )
                                                continue

                                            if not done2_real_item_id:
                                                logger.warning(
                                                    f"Completion event for unknown fake_id={fake_item_id}, call_id={call_id}"
                                                )
                                                continue
                                            if (
                                                done2_real_item_id
                                                in tool_calls_dict.get(chat_id_str, {})
                                            ):
                                                tool_call_id = done2_real_item_id  # type: ignore[assignment]
                                                tool_call_state = tool_calls_dict[
                                                    chat_id_str
                                                ][tool_call_id]

                                                # Only process "speak" tool calls
                                                if (
                                                    tool_call_state.get("name")
                                                    != "speak"
                                                ):
                                                    continue

                                                # Complete the tool call
                                                try:
                                                    final_args = json.loads(
                                                        tool_call_state["arguments_raw"]
                                                    )
                                                    final_message = final_args.get(
                                                        "message",
                                                        tool_call_state[
                                                            "message_so_far"
                                                        ],
                                                    )
                                                    final_persona = final_args.get(
                                                        "persona",
                                                        tool_call_state[
                                                            "persona_so_far"
                                                        ],
                                                    )

                                                    # Update final content
                                                    tool_call_state[
                                                        "message_so_far"
                                                    ] = final_message
                                                    if (
                                                        final_persona
                                                        and not tool_call_state[
                                                            "persona_so_far"
                                                        ]
                                                    ):
                                                        tool_call_state[
                                                            "persona_so_far"
                                                        ] = final_persona

                                                    db_message_id = tool_call_state[
                                                        "db_message_id"
                                                    ]
                                                    if db_message_id:
                                                        # Update DB with final content
                                                        sql_update = load_sql(
                                                            "sql/v3/simulations/update_message_content.sql"
                                                        )
                                                        await conn.execute(
                                                            sql_update,
                                                            final_message,
                                                            str(db_message_id),
                                                        )

                                                        # Complete message
                                                        sql_complete = load_sql(
                                                            "sql/v3/simulations/complete_message.sql"
                                                        )
                                                        await conn.execute(
                                                            sql_complete,
                                                            final_message,
                                                            str(db_message_id),
                                                        )

                                                        # Link to persona if we have it and haven't already
                                                        if final_persona:
                                                            persona_match = (
                                                                find_persona_by_name(
                                                                    final_persona,
                                                                    personas,
                                                                )
                                                            )
                                                            if persona_match:
                                                                persona_id, _ = (
                                                                    persona_match
                                                                )
                                                                sql_link_persona = load_sql(
                                                                    "sql/v3/simulations/link_message_to_persona.sql"
                                                                )
                                                                try:
                                                                    await conn.execute(
                                                                        sql_link_persona,
                                                                        str(
                                                                            db_message_id
                                                                        ),
                                                                        str(persona_id),
                                                                    )
                                                                except Exception:
                                                                    pass  # Already linked or error

                                                        # Emit completion event
                                                        await simulation_message_complete(
                                                            SimulationMessageCompletePayload(
                                                                message_id=str(
                                                                    db_message_id
                                                                ),
                                                                chat_id=chat_id_str,
                                                                final_content=final_message,
                                                            ),
                                                            room=f"simulation_{chat_id_uuid}",
                                                        )

                                                        # Emit final message update
                                                        persona_id_str = None
                                                        if final_persona:
                                                            persona_match = (
                                                                find_persona_by_name(
                                                                    final_persona,
                                                                    personas,
                                                                )
                                                            )
                                                            if persona_match:
                                                                persona_id_str = str(
                                                                    persona_match[0]
                                                                )

                                                        await simulation_new_message(
                                                            SimulationNewMessagePayload(
                                                                message_id=str(
                                                                    db_message_id
                                                                ),
                                                                chat_id=chat_id_str,
                                                                role="assistant",
                                                                content=final_message,
                                                                completed=True,
                                                                created_at="",  # Will be updated from DB if needed
                                                                persona_id=persona_id_str,
                                                            ),
                                                            room=f"simulation_{chat_id_uuid}",
                                                        )

                                                        # Track completed tool messages for hint generation
                                                        completed_tool_messages.append(
                                                            {
                                                                "id": db_message_id,
                                                                "content": final_message,
                                                            }
                                                        )

                                                    # Clean up tool call state
                                                    del tool_calls_dict[chat_id_str][
                                                        tool_call_id
                                                    ]

                                                except json.JSONDecodeError as e:
                                                    logger.error(
                                                        f"Failed to parse final tool call arguments: {e}"
                                                    )
                                                    # Still try to complete with what we have
                                                    if tool_call_state["db_message_id"]:
                                                        final_message = tool_call_state[
                                                            "message_so_far"
                                                        ]
                                                        sql_complete = load_sql(
                                                            "sql/v3/simulations/complete_message.sql"
                                                        )
                                                        await conn.execute(
                                                            sql_complete,
                                                            final_message,
                                                            str(
                                                                tool_call_state[
                                                                    "db_message_id"
                                                                ]
                                                            ),
                                                        )
                                                        await simulation_message_complete(
                                                            SimulationMessageCompletePayload(
                                                                message_id=str(
                                                                    tool_call_state[
                                                                        "db_message_id"
                                                                    ]
                                                                ),
                                                                chat_id=chat_id_str,
                                                                final_content=final_message,
                                                            ),
                                                            room=f"simulation_{chat_id_uuid}",
                                                        )
                                                        del tool_calls_dict[
                                                            chat_id_str
                                                        ][tool_call_id]

                    except BaseException as stream_error:
                        # Re-raise CancelledError and other BaseExceptions to outer handler
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
                        # Complete any remaining tool calls that weren't completed during streaming
                        # Note: We need to use a fresh connection here since conn might be closed
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

                                                    # Try to parse final JSON if available
                                                    try:
                                                        if tool_call_state.get(
                                                            "arguments_raw"
                                                        ):
                                                            final_args = json.loads(
                                                                tool_call_state[
                                                                    "arguments_raw"
                                                                ]
                                                            )
                                                            final_message = (
                                                                final_args.get(
                                                                    "message",
                                                                    final_message,
                                                                )
                                                            )
                                                    except json.JSONDecodeError:
                                                        pass  # Use accumulated message

                                                    # Update DB
                                                    sql_update = load_sql(
                                                        "sql/v3/simulations/update_message_content.sql"
                                                    )
                                                    await cleanup_conn.execute(
                                                        sql_update,
                                                        final_message,
                                                        str(db_message_id),
                                                    )

                                                    sql_complete = load_sql(
                                                        "sql/v3/simulations/complete_message.sql"
                                                    )
                                                    await cleanup_conn.execute(
                                                        sql_complete,
                                                        final_message,
                                                        str(db_message_id),
                                                    )

                                                    # Emit completion
                                                    await simulation_message_complete(
                                                        SimulationMessageCompletePayload(
                                                            message_id=str(
                                                                db_message_id
                                                            ),
                                                            chat_id=chat_id_str,
                                                            final_content=final_message,
                                                        ),
                                                        room=f"simulation_{chat_id_uuid}",
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
                                except Exception as e:
                                    logger.error(
                                        f"Error acquiring connection for cleanup: {e}",
                                        exc_info=True,
                                    )

                            # Clean up tool call states
                            del tool_calls_dict[chat_id_str]

                        # Clean up active run
                        from app.utils.websocket.remove_active_run import (
                            remove_active_run,
                        )

                        await remove_active_run(chat_id_str)

                    # Emit async pricing event (non-blocking)
                    # This handles token updates and message logging in background
                    # Note: For simulations, assistant output is handled via tool calls, not a single message
                    usage = result.context_wrapper.usage
                    await internal_sio.emit(
                        "log_run",
                        {
                            "runId": str(model_run_id),
                            "operationType": "simulation",
                            "inputTextTokens": usage.input_tokens,
                            "outputTextTokens": usage.output_tokens,
                            "systemPrompt": context["system_prompt"],
                            "inputItems": input_items,  # Serialized TResponseInputItem list
                            "assistantOutput": None,  # Simulations use tool calls, not single assistant output
                            "departmentId": str(context.get("department_id")),
                        },
                    )

                    # Emit global run complete event (chat-wide, indicates all persona tool calls finished)
                    await simulation_run_complete(
                        SimulationRunCompletePayload(chat_id=str(chat_id_uuid)),
                        room=f"simulation_{chat_id_uuid}",
                    )
                except OutputGuardrailTripwireTriggered as e:
                    # Handle guardrail-triggered output
                    reason = ""
                    try:
                        reason = (
                            getattr(e, "guardrail_result", None)
                            and getattr(e.guardrail_result, "output", None)
                            and getattr(e.guardrail_result.output, "output_info", None)
                            and getattr(
                                e.guardrail_result.output.output_info, "reason", ""
                            )
                        ) or ""
                    except Exception:
                        reason = ""

                    error_text = f"Error: {reason or 'Guardrail tripwire triggered'}"

                    await simulation_message_error(
                        SimulationMessageErrorPayload(
                            chat_id=str(chat_id_uuid), error=error_text
                        ),
                        room=f"simulation_{chat_id_uuid}",
                    )
                    # Emit run complete event on error to ensure stop button turns off
                    await simulation_run_complete(
                        SimulationRunCompletePayload(chat_id=str(chat_id_uuid)),
                        room=f"simulation_{chat_id_uuid}",
                    )

                # 6. Trigger hint generation for practice simulations (on last tool call message completion)
                # Each tool call message completes independently, so we trigger hint generation
                # after all tool calls are processed
                if completed_tool_messages:
                    # Get the last completed tool message for hint generation
                    last_tool_message = completed_tool_messages[-1]

                    # Trigger hint generation for practice simulations only (fire and forget)
                    # Use optimized query to get simulation metadata
                    sql = load_sql(
                        "sql/v3/simulations/get_simulation_metadata_for_chat.sql"
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
                            f"Triggering hint generation for practice message {last_tool_message['id']}"
                        )
                        # Extract department_id from run context for hint generation
                        sql = load_sql("sql/v3/agents/get_simulation_run_context.sql")
                        run_context_for_hints = await conn.fetchrow(
                            sql, str(chat_id_uuid)
                        )
                        hint_dept_id = (
                            run_context_for_hints.get("department_id")
                            if run_context_for_hints
                            else None
                        )
                        if not hint_dept_id:
                            logger.warning(
                                f"Failed to get department_id for hint generation in chat {chat_id_uuid}"
                            )
                        else:
                            asyncio.create_task(
                                _generate_hints_background_inline(
                                    chat_id=chat_id_uuid,
                                    message_id=last_tool_message["id"],
                                    department_id=uuid.UUID(hint_dept_id),
                                )
                            )
                    else:
                        # Skipping hint generation for non-practice simulation
                        pass

            except Exception as e:
                logger.error(f"Error processing simulation message: {str(e)}")
                # Emit the explicit error event for toasts/state resets
                # Only emit explicit error event if not cancelled
                if (
                    "cancelled" not in str(e).lower()
                    and "canceled" not in str(e).lower()
                ):
                    logger.info(f"Emitting error to room simulation_{chat_id_uuid}")
                    await simulation_message_error(
                        SimulationMessageErrorPayload(
                            chat_id=str(chat_id_uuid), error=str(e)
                        ),
                        room=f"simulation_{chat_id_uuid}",
                    )
                    # Emit run complete event on error to ensure stop button turns off
                    await simulation_run_complete(
                        SimulationRunCompletePayload(chat_id=str(chat_id_uuid)),
                        room=f"simulation_{chat_id_uuid}",
                    )

    except Exception as e:
        logger.error(f"Error in simulation_text_send for {sid}: {str(e)}")

        # Try to create an error message in the database if we have a valid chat_id
        try:
            chat_id = data.chat_id
            if chat_id:
                pool = get_pool()
                if pool:
                    async with pool.acquire() as conn:
                        # Get run_id from chat_id
                        sql_get_run = load_sql(
                            "sql/v3/simulations/get_latest_run_for_chat.sql"
                        )
                        run_row = await conn.fetchrow(
                            sql_get_run,
                            uuid.UUID(chat_id),
                        )
                        if run_row:
                            # Create an error message in the database
                            sql = load_sql(
                                "sql/v3/simulations/insert_error_message.sql"
                            )
                            error_message_record = await conn.fetchrow(
                                sql,
                                run_row["run_id"],
                                f"Error: {str(e)}",
                            )
                        else:
                            error_message_record = None

                        # Emit the error message to clients
                        if error_message_record and hasattr(
                            error_message_record, "items"
                        ):
                            # Convert asyncpg.Record to dict
                            error_message_dict: dict[str, Any] = {
                                k: v for k, v in error_message_record.items()
                            }
                            created_at = error_message_dict.get("created_at")
                            created_at_str = (
                                created_at.isoformat()
                                if created_at and hasattr(created_at, "isoformat")
                                else str(created_at)
                                if created_at
                                else ""
                            )
                            error_message_id = str(error_message_dict.get("id", ""))

                            await simulation_new_message(
                                SimulationNewMessagePayload(
                                    message_id=str(error_message_id),
                                    chat_id=str(chat_id),
                                    role="assistant",
                                    content=f"Error: {str(e)}",
                                    completed=True,
                                    created_at=created_at_str,
                                ),
                                room=f"simulation_{chat_id}",
                            )
        except Exception as db_error:
            logger.error(f"Failed to create error message in database: {db_error}")

        # Also emit the error event for backward compatibility
        await simulation_text_send_error(
            SendSimulationMessageErrorPayload(success=False, message=str(e)), room=sid
        )


@sio.event  # type: ignore
async def simulation_text_send(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = SendSimulationMessagePayload(**data)
        await _simulation_text_send_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in simulation_text_send for {sid}: {e}")
        await simulation_text_send_error(
            SendSimulationMessageErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/send", response_model=dict[str, bool])
async def simulation_text_send_api(
    request: SendSimulationMessagePayload,
) -> dict[str, bool]:
    """Client-to-server event: Send a message in a text simulation."""
    return {"success": True}


@server_router.post("/send_error", response_model=dict[str, bool])
async def simulation_text_send_error_api(
    request: SendSimulationMessageErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while sending simulation message."""
    return {"success": True}


@server_router.post("/hint_generation_progress", response_model=dict[str, bool])
async def hint_generation_progress_api(
    request: HintGenerationProgressPayload,
) -> dict[str, bool]:
    """Server-to-client event: Hint generation progress update."""
    return {"success": True}


@server_router.post("/new_message", response_model=dict[str, bool])
async def simulation_new_message_api(
    request: SimulationNewMessagePayload,
) -> dict[str, bool]:
    """Server-to-client event: New simulation message created."""
    return {"success": True}


@server_router.post("/message_token", response_model=dict[str, bool])
async def simulation_message_token_api(
    request: SimulationMessageTokenPayload,
) -> dict[str, bool]:
    """Server-to-client event: Simulation message token update."""
    return {"success": True}


@server_router.post("/message_complete", response_model=dict[str, bool])
async def simulation_message_complete_api(
    request: SimulationMessageCompletePayload,
) -> dict[str, bool]:
    """Server-to-client event: Simulation message completed."""
    return {"success": True}


@server_router.post("/message_error", response_model=dict[str, bool])
async def simulation_message_error_api(
    request: SimulationMessageErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred in simulation message."""
    return {"success": True}


@server_router.post("/message_cancelled", response_model=dict[str, bool])
async def simulation_message_cancelled_api(
    request: SimulationMessageCancelledPayload,
) -> dict[str, bool]:
    """Server-to-client event: Simulation message was cancelled."""
    return {"success": True}


@server_router.post("/message_sent", response_model=dict[str, bool])
async def message_sent_api(request: MessageSentPayload) -> dict[str, bool]:
    """Server-to-client event: User message sent successfully."""
    return {"success": True}
