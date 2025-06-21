
import uuid
from typing import AsyncGenerator, Optional

from agents import Runner, trace
from agents.items import TResponseInputItem
from app.db import get_session
from app.models import (Agents, EvalChats, EvalMessages, EvalRuns, Evals,
                        Scenarios)
from app.services.agents.generic import GenericAgent
from app.utils.chat import (generate_natural_opening,
                            get_eval_conversation_history)
from app.utils.classes import get_class_info
from fastapi import Depends
from openai.types.responses import ResponseTextDeltaEvent
from sqlmodel import Session, select


async def run_eval_agent(
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

    # Try to get the eval chat
    eval_chat = session.exec(
        select(EvalChats).where(EvalChats.id == chat_id)
    ).one_or_none()

    if eval_chat and input_text:
        # Handle eval chat
        async for token in _handle_eval_chat(eval_chat, session):
            yield token
    else:
        raise ValueError(f"Chat not found with ID: {chat_id}")





async def _handle_eval_chat(
    chat: EvalChats, session: Session
) -> AsyncGenerator[str, None]:
    """Handle eval chat processing."""

    # Get the eval run
    eval_run = session.exec(
        select(EvalRuns).where(EvalRuns.id == chat.eval_run_id)
    ).one()
    if not eval_run:
        raise ValueError(f"Eval run not found for chat {chat.id}")
    
    # get the eval for this eval run
    eval_obj = session.exec(select(Evals).where(Evals.id == eval_run.eval_id)).one()
    if not eval_obj:
        raise ValueError(f"Eval not found for eval run {eval_run.id}")
    
    max_turns = eval_obj.max_turns
    # get the query agent from the eval base_agent_id
    query_agent = session.exec(select(Agents).where(Agents.id == eval_obj.base_agent_id)).one()
    if not query_agent:
        raise ValueError(f"Base agent not found for eval {eval_obj.id}")
    
    # Get the agent from the eval run
    response_agent = session.exec(select(Agents).where(Agents.id == eval_run.agent_id)).one()
    if not response_agent:
        raise ValueError(f"Agent not found for eval run {eval_run.id}")
    
    # find out what turn it is by checking the length of eval messages
    eval_messages = session.exec(
        select(EvalMessages).where(EvalMessages.chat_id == chat.id)
    ).all()
    turn_number = len(eval_messages)

    if turn_number >= max_turns:
        return

    if turn_number == 0:
        input_text = generate_natural_opening(query_agent)

        # add a new message with the input text
        message = EvalMessages(chat_id=chat.id, content=input_text, type="query")
        session.add(message)
        session.commit()
    else:
        # get the latest message
        latest_message = eval_messages[-1]
        input_text = latest_message.content

    # Add a new message with an empty response
    message = EvalMessages(chat_id=chat.id, content="", type="response" if turn_number % 2 == 0 else "query")
    session.add(message)

    # Get all the messages for the chat_id, including the new one, order by created_at
    messages = session.exec(
        select(EvalMessages)
        .where(EvalMessages.chat_id == chat.id)
    ).all()

    messages = list(messages)
    messages = sorted(messages, key=lambda x: x.created_at)

    # Prepare conversation history - need to adapt for eval messages
    conversation_history = get_eval_conversation_history(messages)

    # Get scenario info for context
    scenario = session.exec(
        select(Scenarios).where(Scenarios.id == chat.scenario_id)
    ).one()
    scenario_context = f"Scenario: {scenario.name} - {scenario.description}"

    # Get class info if available
    class_info: TResponseInputItem | None = None
    if scenario.class_id:
        class_info = get_class_info(scenario.class_id, session)

    input_items: list[TResponseInputItem] = [{"role": "assistant", "content": scenario_context}]
    if class_info:
        input_items.append(class_info)
    input_items.extend(conversation_history)

    # if turn_number is even, use the response agent, otherwise use the query agent
    if turn_number % 2 == 0:
        agent = response_agent
    else:
        agent = query_agent

    # Define the agent with agent-specific behavior
    agent_instance = GenericAgent(
        agent_name=agent.name,
        agent_prompt=agent.system_prompt,
        temperature=agent.temperature,
    )

    with trace(chat.title, trace_id=chat.trace_id, group_id=str(eval_run.id)) as chat_trace:
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
    full_response = ""
    async for event in result.stream_events():
        if event.type == "raw_response_event":
            if isinstance(event.data, ResponseTextDeltaEvent):
                chunk = event.data.delta
                full_response += chunk
                yield chunk

    # Update the message with the full response
    message.content = full_response
    session.add(message)
    session.commit()