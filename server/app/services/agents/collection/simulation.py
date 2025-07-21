import os
import uuid
from typing import AsyncGenerator

import PyPDF2
from agents import Runner, trace
from agents.items import TResponseInputItem
from app.db import get_session
from app.extensions import UPLOAD_FOLDER
from app.models import (Agents, Documents, Models, Providers, Scenarios,
                        SimulationAttempts, SimulationChats,
                        SimulationMessages)
from app.services.agents.generic import GenericAgent
from app.utils.chat import (get_chat_scenario,
                            get_simulation_conversation_history)
from app.utils.classes import get_class_info
from fastapi import Depends
from openai.types.responses import ResponseTextDeltaEvent
from sqlmodel import Session, select


async def run_simulation_agent(
    chat_id: uuid.UUID,
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
        async for token in _handle_simulation_chat(simulation_chat, session):
            yield token
    else:
        raise ValueError(f"Chat not found with ID: {chat_id}")


def cancel_simulation_run(chat_id: uuid.UUID) -> bool:
    """
    Cancel an active simulation run using unified tracking.

    Args:
        chat_id: The ID of the chat session to cancel

    Returns:
        bool: True if the run was found and cancelled, False otherwise
    """
    from app.main import cancel_active_run

    return cancel_active_run(str(chat_id))


async def _handle_simulation_chat(
    chat: SimulationChats, session: Session
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

    if not scenario.agent_id:
        raise ValueError(f"Scenario {scenario.id} has no agent_id")

    if not scenario.class_id:
        raise ValueError(f"Scenario {scenario.id} has no class_id")

    agent = session.exec(select(Agents).where(Agents.id == scenario.agent_id)).one()
    if not agent:
        raise ValueError(f"Agent not found for scenario {scenario.id}")

    input_items: list[TResponseInputItem] = []
    if scenario.document_ids:
        # get the documents for the scenario
        documents = session.exec(
            select(Documents).where(Documents.id.in_(scenario.document_ids))
        ).all()
        if not documents:
            raise ValueError(f"Documents not found for scenario {scenario.id}")
        for document in documents:
            file_path = document.file_path
            full_path = os.path.join(UPLOAD_FOLDER, file_path)

            # Determine file type and read content accordingly
            content = ""
            if file_path.lower().endswith(".pdf"):
                # Handle PDF files
                try:
                    with open(full_path, "rb") as file:
                        pdf_reader = PyPDF2.PdfReader(file)
                        for page in pdf_reader.pages:
                            content += page.extract_text() + "\n"
                except Exception as e:
                    raise ValueError(f"Error reading PDF file {file_path}: {str(e)}")
            else:
                # Handle text files and other text-based formats
                try:
                    with open(full_path, "r", encoding="utf-8") as file:
                        content = file.read()
                except UnicodeDecodeError:
                    # Try with different encoding if UTF-8 fails
                    try:
                        with open(full_path, "r", encoding="latin-1") as file:
                            content = file.read()
                    except Exception as e:
                        raise ValueError(
                            f"Error reading text file {file_path}: {str(e)}"
                        )
                except Exception as e:
                    raise ValueError(f"Error reading file {file_path}: {str(e)}")

            if content.strip():  # Only add non-empty content
                input_items.append({"role": "user", "content": content})

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
    class_info = get_class_info(scenario.class_id, session)

    input_items.insert(0, chat_scenario)
    if class_info:
        input_items.append(class_info)
    input_items.extend(conversation_history)

    # getting the model from the agent's model_id
    model = session.exec(select(Models).where(Models.id == agent.model_id)).one()
    if not model:
        raise ValueError(f"Model with ID {agent.model_id} not found")

    # getting the provider from the model's provider_id
    provider = session.exec(
        select(Providers).where(Providers.id == model.provider_id)
    ).one()
    if not provider:
        raise ValueError(f"Provider with ID {model.provider_id} not found")

    agent_instance = GenericAgent(
        agent_name=agent.name,
        system_prompt=agent.system_prompt,
        temperature=agent.temperature,
        model_name=model.name,
        model_provider=provider.name,
        reasoning=agent.reasoning,
        api_key=provider.api_key,
    )

    with trace(chat.title, trace_id=chat.trace_id, group_id=str(attempt.id)):
        result = Runner.run_streamed(
            agent_instance.agent(),
            input=input_items,
        )

    # Store the result in active runs for potential cancellation using unified tracking
    from app.main import store_active_run

    chat_id_str = str(chat.id)
    store_active_run(chat_id_str, result)

    try:
        # Process streaming events
        async for event in result.stream_events():
            if event.type == "raw_response_event":
                if isinstance(event.data, ResponseTextDeltaEvent):
                    chunk = event.data.delta
                    yield chunk
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
        from app.main import active_runs

        if chat_id_str in active_runs:
            del active_runs[chat_id_str]
