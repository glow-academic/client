import asyncio
import uuid
from collections.abc import AsyncGenerator

import asyncpg  # type: ignore
from agents import Runner, gen_trace_id, trace
from agents.items import TResponseInputItem
from app.agents.collection.guardrail import get_output_guardrails
from app.agents.generic import GenericAgent
from app.db import get_db
from app.utils.sql_helper import load_sql
from app.utils.chat import get_simulation_conversation_history
from app.utils.debug_info import DebugContext
from app.utils.document import format_document_info
from fastapi import Depends
from openai.types.responses import ResponseTextDeltaEvent


async def run_simulation_agent(
    chat_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
) -> AsyncGenerator[str, None]:
    """
    This function is used to run the generic agent using the OpenAI Agents SDK.
    Returns a streamable result that yields clean text chunks as they're generated.
    The agent behavior is customized based on the agent's description.

    Now supports both simulation chats and eval chats by detecting the chat type.

    Args:
        chat_id: The ID of the chat session (can be simulation_chat_id or eval_chat_id)
        conn: Database connection
    Yields:
        Text chunks from the agent's response
    """

    # Handle simulation chat - department_id will be extracted from context
    async for token in _handle_simulation_chat(chat_id, conn):
        yield token


async def cancel_simulation_run(chat_id: uuid.UUID) -> bool:
    """
    Cancel an active simulation run using unified tracking.

    Args:
        chat_id: The ID of the chat session to cancel

    Returns:
        bool: True if the run was found and cancelled, False otherwise
    """
    from app.extensions import cancel_active_run

    return await cancel_active_run(str(chat_id))


async def _handle_simulation_chat(
    chat_id: uuid.UUID, conn: asyncpg.Connection
) -> AsyncGenerator[str, None]:
    """Handle simulation chat processing."""

    # Get all context data in a single optimized query using SQL file
    sql = load_sql("sql/v3/agents/get_simulation_run_context.sql")
    context_row = await conn.fetchrow(sql, str(chat_id))
    
    if not context_row:
        raise ValueError(f"Chat {chat_id} not found or no persona configured")
    
    # Parse JSON array for documents
    import json
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
        "temperature": float(context_row["temperature"]) if context_row["temperature"] is not None else 0.0,
        "reasoning": context_row["reasoning"],
        "model_id": context_row["model_id"],
        "model_name": context_row["model_name"],
        "custom_model": context_row["custom_model"],
        "provider_id": context_row["provider_id"],
        "provider_name": context_row["provider_name"],
        "base_url": context_row["base_url"],
        "api_key": context_row["api_key"],
        "image_input_active": context_row["image_input_enabled"],
        "output_guardrail_active": context_row["output_guardrail_enabled"],
        "profile_id": context_row["profile_id"],
        "documents": documents,
        "req_per_day": context_row["req_per_day"],
        "runs_today_count": context_row["runs_today_count"],
        "earliest_run_created_at": context_row["earliest_run_created_at"],
    }
    
    # Extract department_id from context (already retrieved from scenario_departments junction)
    if not context.get("department_id"):
        raise ValueError(f"Failed to get department_id from run context for chat {chat_id}")
    
    department_id = uuid.UUID(context["department_id"])

    input_items: list[TResponseInputItem] = []

    # Format document info if documents are available
    if context["documents"]:
        document_info = format_document_info(
            context["documents"], context["image_input_active"]
        )
        input_items.append(document_info)

    # Get all messages using SQL file
    sql_messages = load_sql("sql/v3/simulations/get_simulation_messages.sql")
    message_rows = await conn.fetch(sql_messages, str(chat_id))
    messages = [dict(row) for row in message_rows]

    # Prepare conversation history from chat_id
    conversation_history = get_simulation_conversation_history(messages)

    # Format chat scenario using the problem statement from context
    from app.utils.chat import format_chat_scenario

    chat_scenario = format_chat_scenario(context["problem_statement"])

    input_items.insert(0, chat_scenario)
    input_items.extend(conversation_history)

    # Get output guardrails if enabled
    output_guards = (
        get_output_guardrails(chat_id, department_id, conversation_history, conn)
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

    # Check rate limit (already included in context query)
    profile_id_uuid = uuid.UUID(context["profile_id"]) if context["profile_id"] else None
    if not profile_id_uuid:
        raise ValueError("Profile not found. Please contact support.")
    
    req_per_day = context["req_per_day"]
    runs_today_count = context["runs_today_count"]
    
    if req_per_day is not None and runs_today_count >= req_per_day:
        # Rate limit exceeded - format error message
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

    # Create model run with all junction records using SQL file (using persona, not agent)
    sql_create_run = load_sql("sql/v3/model_runs/create_model_run_complete.sql")
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
    from app.main import (remove_active_result, store_active_events,
                          store_active_result, store_active_run)

    chat_id_str = str(chat_id)
    await store_active_run(chat_id_str, result)
    await store_active_result(chat_id_str, result)

    try:
        # Process streaming events
        from app.extensions import get_active_run, is_run_cancelled

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
                    chunk = event.data.delta
                    yield chunk

        usage = result.context_wrapper.usage
        sql_update_tokens = load_sql("sql/v3/model_runs/update_model_run_tokens.sql")
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
        from app.extensions import remove_active_run

        await remove_active_run(chat_id_str)
        await remove_active_result(chat_id_str)
