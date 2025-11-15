"""Handler for send_simulation_message WebSocket event."""

import asyncio
import json
import logging
import uuid
from typing import Any

import socketio  # type: ignore
from agents import Runner, trace
from agents.exceptions import OutputGuardrailTripwireTriggered
from agents.items import TResponseInputItem
from app.main import get_pool, hint_progress, hint_results, sio
from app.utils.agents.build_hint_agent import build_hint_agent
from app.utils.agents.generic_agent import GenericAgent
from app.utils.agents.get_output_guardrails import get_output_guardrails
from app.utils.agents.tools.create_hint_tools import create_hint_tools
from app.utils.chat.format_chat_scenario import format_chat_scenario
from app.utils.chat.get_simulation_conversation_history import \
    get_simulation_conversation_history
from app.utils.debug_info import DebugContext
from app.utils.document.format_document_info import format_document_info
from app.utils.sql_helper import load_sql
from openai.types.responses import ResponseTextDeltaEvent
from pydantic import BaseModel

logger = logging.getLogger(__name__)


# Pydantic models for server-to-client events
class SimulationErrorPayload(BaseModel):
    success: bool
    message: str


class HintGenerationProgressPayload(BaseModel):
    type: str
    message: str | None = None
    error: str | None = None
    chat_id: str
    message_id: str
    hint_ids: list[str] | None = None
    hints_count: int | None = None


class SimulationNewMessagePayload(BaseModel):
    message_id: str
    chat_id: str
    role: str
    content: str
    completed: bool
    created_at: str


class SimulationMessageTokenPayload(BaseModel):
    message_id: str
    chat_id: str
    token: str
    accumulated_content: str


class SimulationMessageCompletePayload(BaseModel):
    message_id: str
    chat_id: str
    final_content: str


class SimulationMessageErrorPayload(BaseModel):
    chat_id: str
    error: str


class SimulationMessageCancelledPayload(BaseModel):
    message_id: str
    chat_id: str
    final_content: str


# Pydantic model for client-to-server event
class SendSimulationMessagePayload(BaseModel):
    chat_id: str
    message: str | None = None
    is_retry: bool = False


# Emit helper functions
async def simulation_error(payload: SimulationErrorPayload, room: str) -> None:
    await sio.emit("simulation_error", payload.model_dump(), room=room)


async def hint_generation_progress(
    payload: HintGenerationProgressPayload, room: str
) -> None:
    await sio.emit("hint_generation_progress", payload.model_dump(exclude_none=True), room=room)


async def simulation_new_message(
    payload: SimulationNewMessagePayload, room: str
) -> None:
    await sio.emit("simulation_new_message", payload.model_dump(), room=room)


async def simulation_message_token(
    payload: SimulationMessageTokenPayload, room: str
) -> None:
    await sio.emit("simulation_message_token", payload.model_dump(), room=room)


async def simulation_message_complete(
    payload: SimulationMessageCompletePayload, room: str
) -> None:
    await sio.emit("simulation_message_complete", payload.model_dump(), room=room)


async def simulation_message_error(
    payload: SimulationMessageErrorPayload, room: str
) -> None:
    await sio.emit("simulation_message_error", payload.model_dump(), room=room)


async def simulation_message_cancelled(
    payload: SimulationMessageCancelledPayload, room: str
) -> None:
    await sio.emit("simulation_message_cancelled", payload.model_dump(), room=room)


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

            # Clear previous results
            hint_results.clear()
            hint_progress.clear()

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
            hint_tools = create_hint_tools()
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
            )
            model_run_id = uuid.UUID(model_run_row["model_run_id"])

            # Run the hint agent
            logger.info("Running hint agent with parallel tool calls...")
            with trace(
                chat["title"], trace_id=chat["trace_id"], group_id=str(attempt["id"])
            ):
                result = await Runner.run(
                    hint_agent.agent(),
                    input=input_items,
                    context=DebugContext(conn=conn, model_run_id=model_run_id),
                )

            # Update token usage using SQL file
            usage = result.context_wrapper.usage
            sql_update_tokens = load_sql(
                "sql/v3/model_runs/update_model_run_tokens.sql"
            )
            await conn.execute(
                sql_update_tokens,
                str(model_run_id),
                usage.input_tokens,
                usage.output_tokens,
            )

            logger.info("Hint agent completed successfully")

            # Extract hints from global storage
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

            # Create SimulationHints records using direct SQL
            hint_ids: list[dict[str, Any]] = []
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
                        INSERT INTO simulation_hints (simulation_message_id, idx, hint)
                        VALUES ($1::uuid, $2, $3)
                        RETURNING simulation_message_id::text, idx
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


@sio.event  # type: ignore
async def send_simulation_message(sid: str, data: SendSimulationMessagePayload) -> None:
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
            f"Processing send_simulation_message from {sid}: {chat_id} (audio: {assistant_audio_enabled}, sketch: {sketch_data is not None})"
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
                # 1. Add the user message to the chat (skip if this is a retry)
                if message_str and message_str.strip() != "" and not is_retry:
                    sql = load_sql("sql/v3/simulations/create_message.sql")
                    user_message_row = await conn.fetchrow(
                        sql, str(chat_id_uuid), "query", message_str, True
                    )
                    user_message = {
                        "id": user_message_row["id"],
                        "created_at": user_message_row["created_at"],
                    }

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
                else:
                    if is_retry:
                        logger.info(
                            f"Skipping user message creation for retry in chat {chat_id_uuid}"
                        )

                # 3. Create placeholder assistant message
                sql = load_sql("sql/v3/simulations/create_message.sql")
                assistant_message_row = await conn.fetchrow(
                    sql, str(chat_id_uuid), "response", "", False
                )
                assistant_message = {
                    "id": assistant_message_row["id"],
                    "created_at": assistant_message_row["created_at"],
                }

                # 4. Emit placeholder assistant message
                logger.info(
                    f"Emitting assistant placeholder to room simulation_{chat_id_uuid}"
                )
                await simulation_new_message(
                    SimulationNewMessagePayload(
                        message_id=str(assistant_message["id"]),
                        chat_id=str(chat_id_uuid),
                        role="assistant",
                        content="",
                        completed=False,
                        created_at=assistant_message["created_at"].isoformat(),
                    ),
                    room=f"simulation_{chat_id_uuid}",
                )

                logger.info(f"Processing simulation message for chat {chat_id_uuid}")

                # 5. Stream the assistant response (inlined run_simulation_agent)
                accumulated_content = ""
                cancelled = False

                try:
                    # Cooperative cancellation support using Redis flags
                    # We poll for a cancellation flag bound to this chat's active run ID
                    from app.utils.websocket.get_active_run import \
                        get_active_run
                    from app.utils.websocket.is_run_cancelled import \
                        is_run_cancelled
                    from app.utils.websocket.remove_active_result import \
                        remove_active_result
                    from app.utils.websocket.store_active_events import \
                        store_active_events
                    from app.utils.websocket.store_active_result import \
                        store_active_result
                    from app.utils.websocket.store_active_run import \
                        store_active_run

                    # Get all context data in a single optimized query using SQL file
                    sql = load_sql("sql/v3/agents/get_simulation_run_context.sql")
                    context_row = await conn.fetchrow(sql, str(chat_id_uuid))

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
                        "output_guardrail_active": context_row[
                            "output_guardrail_enabled"
                        ],
                        "profile_id": context_row["profile_id"],
                        "documents": documents,
                        "req_per_day": context_row["req_per_day"],
                        "runs_today_count": context_row["runs_today_count"],
                        "earliest_run_created_at": context_row[
                            "earliest_run_created_at"
                        ],
                    }

                    # Extract department_id from context
                    if not context.get("department_id"):
                        raise ValueError(
                            f"Failed to get department_id from run context for chat {chat_id_uuid}"
                        )

                    department_id = uuid.UUID(context["department_id"])

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

                    # Get output guardrails if enabled
                    output_guards = (
                        get_output_guardrails(
                            chat_id_uuid, department_id, conversation_history, conn
                        )
                        if context["output_guardrail_active"]
                        else None
                    )

                    # Create agent instance using context data
                    agent_instance = GenericAgent(
                        agent_name=context["persona_name"],
                        system_prompt=context["system_prompt"],
                        temperature=context["temperature"],
                        model_name=context["model_name"],
                        model_provider=context["provider_name"],
                        base_url=context["base_url"],
                        reasoning=context["reasoning"],
                        api_key=context["api_key"],
                        output_guardrails=output_guards,
                        custom_model=context["custom_model"],
                    )

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
                    )
                    model_run_id = uuid.UUID(model_run_row["model_run_id"])

                    with trace(
                        context["chat_title"],
                        trace_id=context["trace_id"],
                        group_id=context["attempt_id"],
                    ):
                        result = Runner.run_streamed(
                            agent_instance.agent(),
                            input=input_items,
                            context=DebugContext(conn=conn, model_run_id=model_run_id),
                        )

                    # Store the result in active runs for potential cancellation using unified tracking
                    chat_id_str = str(chat_id_uuid)
                    await store_active_run(chat_id_str, result)
                    await store_active_result(chat_id_str, result)

                    try:
                        # Process streaming events
                        events = result.stream_events()
                        await store_active_events(chat_id_str, events)

                        async for event in events:
                            # Cooperative cancellation: check a Redis flag bound to this chat's active run
                            try:
                                run_id = await get_active_run(chat_id_str)
                                if run_id and await is_run_cancelled(run_id):
                                    # Raise a cancellation to unwind upstream and hit finally cleanup
                                    raise Exception("cancelled")
                            except Exception:
                                # If Redis unavailable or check fails, continue; stop is best-effort
                                pass
                            if event.type == "raw_response_event":
                                if isinstance(event.data, ResponseTextDeltaEvent):
                                    token = event.data.delta

                                    # Check cancellation BEFORE processing this token to avoid emitting it
                                    try:
                                        run_id = await get_active_run(chat_id_str)
                                        if run_id and await is_run_cancelled(run_id):
                                            cancelled = True
                                            sql = load_sql(
                                                "sql/v3/simulations/complete_message.sql"
                                            )
                                            await conn.execute(
                                                sql, None, str(assistant_message["id"])
                                            )
                                            break
                                    except Exception:
                                        pass

                                    # Regular content token
                                    accumulated_content += token

                                    # Update the database with accumulated content
                                    sql = load_sql(
                                        "sql/v3/simulations/update_message_content.sql"
                                    )
                                    await conn.execute(
                                        sql,
                                        accumulated_content,
                                        str(assistant_message["id"]),
                                    )

                                    logger.info(
                                        f"Emitting token to room simulation_{chat_id_uuid}: {token[:20]}..."
                                    )
                                    await simulation_message_token(
                                        SimulationMessageTokenPayload(
                                            message_id=str(assistant_message["id"]),
                                            chat_id=str(chat_id_uuid),
                                            token=token,
                                            accumulated_content=accumulated_content,
                                        ),
                                        room=f"simulation_{chat_id_uuid}",
                                    )
                                    if cancelled:
                                        break

                        usage = result.context_wrapper.usage
                        sql_update_tokens = load_sql(
                            "sql/v3/model_runs/update_model_run_tokens.sql"
                        )
                        await conn.execute(
                            sql_update_tokens,
                            str(model_run_id),
                            usage.input_tokens,
                            usage.output_tokens,
                        )
                    except (asyncio.CancelledError, GeneratorExit, StopAsyncIteration):
                        # Treat explicit cancellation/closure as expected
                        pass
                    except Exception as e:
                        # Handle cancellation or other errors
                        if "cancelled" in str(e).lower():
                            # This is expected when the run is cancelled
                            pass
                        else:
                            # Re-raise other exceptions
                            raise e
                    finally:
                        # Clean up the active run using unified tracking
                        from app.utils.websocket.remove_active_run import \
                            remove_active_run

                        await remove_active_run(chat_id_str)
                        await remove_active_result(chat_id_str)
                except OutputGuardrailTripwireTriggered as e:
                    # Handle guardrail-triggered output: overwrite message with model-provided reason
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

                    # Persist error onto the assistant message and emit completion + error
                    sql = load_sql("sql/v3/simulations/complete_message.sql")
                    await conn.execute(sql, error_text, str(assistant_message["id"]))

                    await simulation_message_complete(
                        SimulationMessageCompletePayload(
                            message_id=str(assistant_message["id"]),
                            chat_id=str(chat_id_uuid),
                            final_content=error_text,
                        ),
                        room=f"simulation_{chat_id_uuid}",
                    )

                    await simulation_message_error(
                        SimulationMessageErrorPayload(
                            chat_id=str(chat_id_uuid), error=error_text
                        ),
                        room=f"simulation_{chat_id_uuid}",
                    )

                    # Skip later completion emission
                    cancelled = True

                except Exception as e:
                    if "cancelled" in str(e).lower() or "canceled" in str(e).lower():
                        # Handle cancellation gracefully
                        cancelled = True
                        logger.info(
                            f"Simulation run for chat {chat_id_uuid} was cancelled"
                        )

                        # Keep content as-is, don't add cancellation notice
                        # Mark message as completed when cancelled
                        sql = load_sql("sql/v3/simulations/complete_message.sql")
                        await conn.execute(
                            sql, accumulated_content, str(assistant_message["id"])
                        )

                        # Emit cancellation signal
                        logger.info(
                            f"Emitting cancellation to room simulation_{chat_id_uuid}"
                        )
                        await simulation_message_cancelled(
                            SimulationMessageCancelledPayload(
                                message_id=str(assistant_message["id"]),
                                chat_id=str(chat_id_uuid),
                                final_content=accumulated_content,
                            ),
                            room=f"simulation_{chat_id_uuid}",
                        )
                    else:
                        # Re-raise other exceptions
                        raise e

                # 6. Mark as completed and ensure final content is persisted
                sql = load_sql("sql/v3/simulations/complete_message.sql")
                await conn.execute(
                    sql, accumulated_content, str(assistant_message["id"])
                )

                # 7. Emit completion signal (only if not cancelled)
                if not cancelled:
                    logger.info(
                        f"Emitting completion to room simulation_{chat_id_uuid}"
                    )
                    await simulation_message_complete(
                        SimulationMessageCompletePayload(
                            message_id=str(assistant_message["id"]),
                            chat_id=str(chat_id_uuid),
                            final_content=accumulated_content,
                        ),
                        room=f"simulation_{chat_id_uuid}",
                    )

                    # 8. Trigger hint generation for practice simulations only (fire and forget)
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
                            f"Triggering hint generation for practice message {assistant_message['id']}"
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
                                    message_id=assistant_message["id"],
                                    department_id=uuid.UUID(hint_dept_id),
                                )
                            )
                    else:
                        logger.debug(
                            "Skipping hint generation for non-practice simulation"
                        )

            except Exception as e:
                logger.error(f"Error processing simulation message: {str(e)}")
                # Best-effort: if we have already created a placeholder assistant message,
                # persist the error text onto it and mark it complete so the UI shows it.
                try:
                    error_text = f"Error: {str(e)}"
                    if (
                        "assistant_message" in locals()
                        and assistant_message is not None
                    ):
                        sql = load_sql("sql/v3/simulations/complete_message.sql")
                        await conn.execute(
                            sql, error_text, str(assistant_message["id"])
                        )

                        # Emit a completion update using the same message so the client updates content
                        await simulation_message_complete(
                            SimulationMessageCompletePayload(
                                message_id=str(assistant_message["id"]),
                                chat_id=str(chat_id_uuid),
                                final_content=error_text,
                            ),
                            room=f"simulation_{chat_id_uuid}",
                        )
                except Exception as persist_error:
                    logger.error(
                        f"Failed to persist/emit error content for chat {chat_id_uuid}: {persist_error}"
                    )

                # Also emit the explicit error event for toasts/state resets
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

    except Exception as e:
        logger.error(f"Error in send_simulation_message for {sid}: {str(e)}")

        # Try to create an error message in the database if we have a valid chat_id
        try:
            chat_id = data.chat_id
            if chat_id:
                pool = get_pool()
                if pool:
                    async with pool.acquire() as conn:
                        # Create an error message in the database
                        sql = load_sql("sql/v3/simulations/insert_error_message.sql")
                        error_message = await conn.fetchrow(
                            sql,
                            uuid.UUID(chat_id),
                            "response",
                            f"Error: {str(e)}",
                            True,
                        )

                        # Emit the error message to clients
                        if error_message:
                            created_at = error_message.get("created_at")
                            created_at_str = (
                                created_at.isoformat()
                                if hasattr(created_at, "isoformat")
                                else str(created_at)
                            )
                            await simulation_new_message(
                                SimulationNewMessagePayload(
                                    message_id=str(error_message.get("id", "")),
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
        await simulation_error(
            SimulationErrorPayload(success=False, message=str(e)), room=sid
        )
