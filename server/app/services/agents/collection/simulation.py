import asyncio
import os
import uuid
from typing import AsyncGenerator

import pypdf
from agents import Runner, trace
from agents.items import TResponseInputItem
from app.db import get_session
from app.extensions import UPLOAD_FOLDER
from app.models import (DebugInfo, Documents, ModelRuns, Models, Personas,
                        Providers, Scenarios, SimulationAttempts,
                        SimulationChats, SimulationMessages)
from app.services.agents.collection.guardrail import get_output_guardrails
from app.services.agents.generic import GenericAgent
from app.utils.chat import (get_chat_scenario,
                            get_simulation_conversation_history)
from app.utils.debug_info import DebugContext
from app.utils.document import get_document_info
from app.utils.guest import find_default_guest_profile
from app.utils.limit import check_rate_limit
from fastapi import Depends
from openai.types.responses import ResponseTextDeltaEvent
from sqlmodel import Session, select


async def run_simulation_agent(
    chat_id: uuid.UUID,
    department_id: uuid.UUID,
    session: Session = Depends(get_session),
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
    simulation_chat = session.exec(
        select(SimulationChats).where(SimulationChats.id == chat_id)
    ).one_or_none()

    if simulation_chat:
        # Handle simulation chat
        async for token in _handle_simulation_chat(simulation_chat, department_id, session):
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
    chat: SimulationChats, department_id: uuid.UUID, session: Session
) -> AsyncGenerator[str, None]:
    """Handle simulation chat processing."""

    # Find attempt from chat
    attempt = session.exec(
        select(SimulationAttempts).where(SimulationAttempts.id == chat.attempt_id)
    ).one()
    if not attempt:
        raise ValueError(f"Attempt not found for chat {chat.id}")

    # Get the agent through the scenario relationship
    scenario = session.exec(
        select(Scenarios).where(Scenarios.id == chat.scenario_id)
    ).one()
    if not scenario:
        raise ValueError(f"Scenario not found for chat {chat.id}")

    if not scenario.persona_id:
        raise ValueError(f"Scenario {scenario.id} has no persona_id")

    persona = session.exec(
        select(Personas).where(Personas.id == scenario.persona_id)
    ).one()
    if not persona:
        raise ValueError(f"Persona not found for scenario {scenario.id}")

    show_images = persona.image_input_active

    input_items: list[TResponseInputItem] = []
    if scenario.document_ids:
        document_info = get_document_info(scenario.document_ids, show_images, session)
        input_items.append(document_info)

    # Get all the messages for the chat_id, order by created_at
    messages = session.exec(
        select(SimulationMessages).where(SimulationMessages.chat_id == chat.id)
    ).all()

    # sort messages by created_at
    messages = list(messages)
    messages = sorted(messages, key=lambda x: x.created_at)

    # Prepare conversation history from chat_id
    conversation_history = get_simulation_conversation_history(messages)
    chat_scenario = get_chat_scenario(chat, session)

    input_items.insert(0, chat_scenario)
    input_items.extend(conversation_history)

    # getting the model from the agent's model_id
    model = session.exec(select(Models).where(Models.id == persona.model_id)).one()
    if not model:
        raise ValueError(f"Model with ID {persona.model_id} not found")

    # getting the provider from the model's provider_id
    provider = session.exec(
        select(Providers).where(Providers.id == model.provider_id)
    ).one()
    if not provider:
        raise ValueError(f"Provider with ID {model.provider_id} not found")

    output_guards = (
        get_output_guardrails(chat.id, department_id, conversation_history, session)
        if persona.guardrail_active
        else None
    )

    agent_instance = GenericAgent(
        agent_name=persona.name,
        system_prompt=persona.system_prompt,
        temperature=persona.temperature,
        model_name=model.name,
        model_provider=provider.name,
        base_url=provider.base_url,
        reasoning=persona.reasoning,
        api_key=provider.api_key,
        output_guardrails=output_guards,
        custom_model=model.custom_model,
    )

    default_guest_profile = find_default_guest_profile(session)

    final_profile_id = (attempt.profile_id if attempt.profile_id else (default_guest_profile.id if default_guest_profile else None))

    success, error_message = check_rate_limit(final_profile_id, session)
    if not success:
        raise ValueError(error_message)

    # create model run
    model_run = ModelRuns(
        model_id=model.id,
        input_tokens=0,
        output_tokens=0,
        profile_id=final_profile_id,
        persona_id=persona.id,
        department_id=scenario.department_id,
    )
    session.add(model_run)
    session.commit()

    with trace(chat.title, trace_id=chat.trace_id, group_id=str(attempt.id)):
        result = Runner.run_streamed(
            agent_instance.agent(),
            input=input_items,
            context=DebugContext(session=session, model_run_id=model_run.id)
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
        model_run.input_tokens = usage.input_tokens
        model_run.output_tokens = usage.output_tokens
        session.commit()
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
