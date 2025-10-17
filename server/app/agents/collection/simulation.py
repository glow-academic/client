import asyncio
import os
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

import asyncpg  # type: ignore
import pypdf
from agents import Runner, trace
from agents.items import TResponseInputItem
from app.agents.collection.guardrail import get_output_guardrails
from app.agents.generic import GenericAgent
from app.db import get_db
from app.extensions import UPLOAD_FOLDER
from app.services.model_run_service import ModelRunService
from app.utils.chat import get_simulation_conversation_history
from app.utils.debug_info import DebugContext
from app.utils.document import get_document_info
from app.utils.guest import find_default_guest_profile
from app.utils.limit import check_rate_limit
from app.utils.personas import get_persona_info
from fastapi import Depends
from openai.types.responses import ResponseTextDeltaEvent


async def run_simulation_agent(
    chat_id: uuid.UUID,
    department_id: uuid.UUID,
    conn: asyncpg.Connection = Depends(get_db),
) -> AsyncGenerator[str, None]:
    """
    This function is used to run the generic agent using the OpenAI Agents SDK.
    Returns a streamable result that yields clean text chunks as they're generated.
    The agent behavior is customized based on the agent's description.

    Now supports both simulation chats and eval chats by detecting the chat type.

    Args:
        chat_id: The ID of the chat session (can be simulation_chat_id or eval_chat_id)
        input_text: Optional input text to send to the agent
        test_data: Whether to use test data
        input_audio: Optional audio to send to the agent
    Yields:
        Text chunks from the agent's response
    """

    # Handle simulation chat - validation happens in service layer
    async for token in _handle_simulation_chat(chat_id, department_id, conn):
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
    chat_id: uuid.UUID, department_id: uuid.UUID, conn: asyncpg.Connection
) -> AsyncGenerator[str, None]:
    """Handle simulation chat processing."""

    # Get all context data in a single optimized query
    from app.services.agent_service import AgentService
    agent_service = AgentService(conn)
    context = await agent_service.get_simulation_run_context(chat_id)

    input_items: list[TResponseInputItem] = []
    
    # Load document info if needed
    doc_ids = [uuid.UUID(doc_id) for doc_id in context['document_ids']]
    if doc_ids:
        document_info = await get_document_info(conn, doc_ids, context['image_input_active'])
        input_items.append(document_info)

    # Get all messages using service layer
    messages = await agent_service.get_simulation_messages(chat_id)

    # Prepare conversation history from chat_id
    conversation_history = get_simulation_conversation_history(messages)
    
    # Format chat scenario using the problem statement from context
    from app.utils.chat import format_chat_scenario
    chat_scenario = format_chat_scenario(context['problem_statement'])

    input_items.insert(0, chat_scenario)
    input_items.extend(conversation_history)

    # Get output guardrails if enabled
    output_guards = (
        get_output_guardrails(chat_id, department_id, conversation_history, conn)
        if context['output_guardrail_active']
        else None
    )

    # Create agent instance using context data
    agent_instance = GenericAgent(
        agent_name=context['persona_name'],
        system_prompt=context['system_prompt'],
        temperature=context['temperature'],
        model_name=context['model_name'],
        model_provider=context['provider_name'],
        base_url=context['base_url'],
        reasoning=context['reasoning'],
        api_key=context['api_key'],
        output_guardrails=output_guards,
        custom_model=context['custom_model'],
    )

    # Use profile from context or default guest profile
    final_profile_id = context['profile_id']
    if not final_profile_id:
        default_guest_profile = await find_default_guest_profile(conn)
        final_profile_id = default_guest_profile['id'] if default_guest_profile else None

    success, error_message = await check_rate_limit(conn, final_profile_id)
    if not success:
        raise ValueError(error_message)

    # Create model run with all junction records (using persona, not agent)
    model_run_service = ModelRunService(conn)
    model_run_id = await model_run_service.create_model_run(
        department_id=uuid.UUID(context['department_id']),
        model_id=uuid.UUID(context['model_id']),
        entity_id=uuid.UUID(context['persona_id']),
        entity_type="persona",
        profile_id=final_profile_id,
    )

    with trace(context['chat_title'], trace_id=context['trace_id'], group_id=context['attempt_id']):
        result = Runner.run_streamed(
            agent_instance.agent(),
            input=input_items,
            context=DebugContext(conn=conn, model_run_id=model_run_id)
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
        await model_run_service.update_model_run_tokens(
            model_run_id=model_run_id,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens
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
