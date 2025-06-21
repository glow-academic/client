import os
import uuid
from typing import AsyncGenerator, Optional

import PyPDF2
from agents import Runner, trace
from agents.items import TResponseInputItem
from app.db import get_session
from app.models import Agents, AssistantChats, AssistantMessages
from app.services.agents.generic import GenericAgent
from app.utils.chat import get_assistant_conversation_history
from fastapi import Depends
from openai.types.responses import ResponseTextDeltaEvent
from sqlmodel import Session, select


async def run_assistant_agent(
    chat_id: uuid.UUID,
    input_text: Optional[str] = None,
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
    Yields:
        Text chunks from the agent's response
    """

    # Try to get assistant chat first
    assistant_chat = session.exec(
        select(AssistantChats).where(AssistantChats.id == chat_id)
    ).one_or_none()
    
    if assistant_chat and input_text:
        # Handle assistant chat
        async for token in _handle_assistant_chat(
            assistant_chat, input_text, session
        ):
            yield token
    else:
        raise ValueError(f"Chat not found with ID: {chat_id}")



async def _handle_assistant_chat(
    chat: AssistantChats, input_text: str, session: Session
) -> AsyncGenerator[str, None]:
    """Handle simulation chat processing."""

    # find agent with name of "Assistant"
    agent = session.exec(select(Agents).where(Agents.name == "Assistant")).one()
    if not agent:
        raise ValueError("Assistant agent not found")

    input_items: list[TResponseInputItem] = []

    # Get all the messages for the chat_id, including the new one, order by created_at
    messages = session.exec(
        select(AssistantMessages)
        .where(AssistantMessages.chat_id == chat.id)
    ).all()

    # sort messages by created_at
    messages = list(messages)
    messages = sorted(messages, key=lambda x: x.created_at)

    # Prepare conversation history from chat_id
    conversation_history = get_assistant_conversation_history(messages)
    input_items.extend(conversation_history)

    # Define the agent with agent-specific behavior
    agent_instance = GenericAgent(
        agent_name=agent.name,
        agent_prompt=agent.system_prompt,
        temperature=agent.temperature,
    )

    with trace(chat.title, trace_id=chat.trace_id) as chat_trace:
        result = Runner.run_streamed(
            agent_instance.agent(),
            input=input_items,
        )
        trace_id = chat_trace.trace_id

    # update the trace id to the chat for future reference, if it was orginally None
    if chat.trace_id is None:
        chat.trace_id = trace_id
        session.add(chat)
        session.commit()

    # Process streaming events
    async for event in result.stream_events():
        if event.type == "raw_response_event":
            if isinstance(event.data, ResponseTextDeltaEvent):
                chunk = event.data.delta
                yield chunk

