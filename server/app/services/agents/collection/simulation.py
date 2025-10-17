import asyncio
import os
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

import asyncpg  # type: ignore
import pypdf
from agents import Runner, trace
from agents.items import TResponseInputItem
from app.db import get_db
from app.extensions import UPLOAD_FOLDER
from app.services.agents.collection.guardrail import get_output_guardrails
from app.services.agents.generic import GenericAgent
from app.services.model_run_service import ModelRunService
from app.utils.chat import (get_chat_scenario,
                            get_simulation_conversation_history)
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

    # Try to get simulation chat first
    simulation_chat = await conn.fetchrow(
        "SELECT id, scenario_id, attempt_id, title, trace_id FROM simulation_chats WHERE id = $1",
        chat_id
    )

    if simulation_chat:
        # Handle simulation chat
        async for token in _handle_simulation_chat(dict(simulation_chat), department_id, conn):
            yield token
    else:
        raise ValueError(f"Chat not found with ID: {chat_id}")


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
    chat: Any, department_id: uuid.UUID, conn: asyncpg.Connection
) -> AsyncGenerator[str, None]:
    """Handle simulation chat processing."""

    # Find attempt from chat
    attempt = await conn.fetchrow(
        "SELECT id, simulation_id FROM simulation_attempts WHERE id = $1",
        chat['attempt_id']
    )
    if not attempt:
        raise ValueError(f"Attempt not found for chat {chat['id']}")

    # Get the agent through the scenario relationship
    scenario = await conn.fetchrow(
        "SELECT id, department_id FROM scenarios WHERE id = $1",
        chat['scenario_id']
    )
    if not scenario:
        raise ValueError(f"Scenario not found for chat {chat['id']}")

    # Get persona from scenario_personas junction
    persona_link = await conn.fetchrow("""
        SELECT persona_id
        FROM scenario_personas
        WHERE scenario_id = $1 AND active = true
        LIMIT 1""",
        scenario['id']
    )
    
    if not persona_link:
        raise ValueError(f"Scenario {scenario['id']} has no active persona")

    persona = await conn.fetchrow(
        "SELECT id FROM personas WHERE id = $1",
        persona_link['persona_id']
    )
    if not persona:
        raise ValueError(f"Persona not found for scenario {scenario['id']}")

    # Get simulation to check image_input_active setting
    simulation = await conn.fetchrow(
        "SELECT id, image_input_active FROM simulations WHERE id = $1",
        attempt['simulation_id']
    )
    show_images = simulation['image_input_active'] if simulation else False

    input_items: list[TResponseInputItem] = []
    # Load document IDs from junction table
    doc_links = await conn.fetch(
        "SELECT document_id FROM scenario_documents WHERE scenario_id = $1 AND active = true",
        scenario['id']
    )
    doc_ids = [link['document_id'] for link in doc_links]
    
    if doc_ids:
        document_info = await get_document_info(conn, doc_ids, show_images)
        input_items.append(document_info)

    # Get all the messages for the chat_id, order by created_at
    messages = await conn.fetch("""
        SELECT id, chat_id, role, content, created_at, model_run_id, audio_url, completed
        FROM simulation_messages
        WHERE chat_id = $1
        ORDER BY created_at
    """, chat['id'])

    messages = [dict(m) for m in messages]

    # Prepare conversation history from chat_id
    conversation_history = get_simulation_conversation_history(messages)
    chat_scenario = await get_chat_scenario(conn, chat['scenario_id'])

    input_items.insert(0, chat_scenario)
    input_items.extend(conversation_history)

    # getting the model from the persona's model_id
    persona_full = await conn.fetchrow(
        "SELECT id, name, system_prompt, temperature, reasoning, model_id FROM personas WHERE id = $1",
        persona['id']
    )
    
    model = await conn.fetchrow(
        "SELECT id, name, provider_id, custom_model FROM models WHERE id = $1",
        persona_full['model_id']
    )
    if not model:
        raise ValueError(f"Model with ID {persona_full['model_id']} not found")

    # getting the provider from the model's provider_id
    provider = await conn.fetchrow(
        "SELECT id, name, base_url, api_key FROM providers WHERE id = $1",
        model['provider_id']
    )
    if not provider:
        raise ValueError(f"Provider with ID {model['provider_id']} not found")

    # Get simulation to check guardrail settings
    simulation = await conn.fetchrow(
        "SELECT id, image_input_active, output_guardrail_active FROM simulations WHERE id = $1",
        attempt['simulation_id']
    )
    
    output_guards = (
        get_output_guardrails(chat['id'], department_id, conversation_history, conn)
        if simulation and simulation['output_guardrail_active']
        else None
    )

    agent_instance = GenericAgent(
        agent_name=persona_full['name'],
        system_prompt=persona_full['system_prompt'],
        temperature=persona_full['temperature'],
        model_name=model['name'],
        model_provider=provider['name'],
        base_url=provider['base_url'],
        reasoning=persona_full['reasoning'],
        api_key=provider['api_key'],
        output_guardrails=output_guards,
        custom_model=model['custom_model'],
    )

    # Get profile from attempt_profiles junction
    attempt_profile_link = await conn.fetchrow("""
        SELECT profile_id
        FROM attempt_profiles
        WHERE attempt_id = $1 AND active = true
        LIMIT 1
    """, attempt['id'])
    
    attempt_profile_id = attempt_profile_link['profile_id'] if attempt_profile_link else None

    default_guest_profile = await find_default_guest_profile(conn)

    final_profile_id = (attempt_profile_id if attempt_profile_id else (default_guest_profile['id'] if default_guest_profile else None))

    success, error_message = await check_rate_limit(conn, final_profile_id)
    if not success:
        raise ValueError(error_message)

    # Create model run with all junction records (using persona, not agent)
    model_run_service = ModelRunService(conn)
    model_run_id = await model_run_service.create_model_run(
        department_id=scenario['department_id'],
        model_id=model['id'],
        entity_id=persona['id'],
        entity_type="persona",
        profile_id=final_profile_id,
    )

    with trace(chat['title'], trace_id=chat['trace_id'], group_id=str(attempt['id'])):
        result = Runner.run_streamed(
            agent_instance.agent(),
            input=input_items,
            context=DebugContext(conn=conn, model_run_id=model_run_id)
        )

    # Store the result in active runs for potential cancellation using unified tracking
    from app.main import (remove_active_result, store_active_events,
                          store_active_result, store_active_run)

    chat_id_str = str(chat.id)
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
        await conn.execute("""
            UPDATE model_runs 
            SET input_tokens = $1, output_tokens = $2 
            WHERE id = $3
        """, usage.input_tokens, usage.output_tokens, model_run_id)
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
