from typing import AsyncGenerator, List
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Runner, RunConfig
from openai.types import Reasoning
from datetime import datetime
from app.extensions import get_gemini
from app.utils.chat import generate_natural_opening, get_eval_conversation_history
from app.utils.classes import get_class_info
from app.db import get_session
from sqlmodel import Session, select
from app.models import EvalMessages, EvalChats, EvalRuns, Agents, Scenarios, Evals
from app.utils.agents import gta_prompt, student_prompt
from fastapi import Depends
from openai.types.responses import (
    ResponseTextDeltaEvent,
)
import logging
from pydantic import BaseModel

logger = logging.getLogger(__name__)


async def run_advanced_agent(
    eval_chat_ids: List[str],
    session: Session,
) -> AsyncGenerator[dict, None]:
    """
    Run multiple agent conversations simultaneously using a single agent call.
    This function uses one agent to generate responses for multiple conversations at once,
    making it much more efficient than running separate agents.

    Args:
        eval_chat_ids: List of eval chat IDs to process

    Yields:
        Event dictionaries for streaming to the client
    """

    # only doing for eval chats for now
    eval_chats = session.exec(
            select(EvalChats).where(EvalChats.id.in_(eval_chat_ids))
        ).all()

    if len(eval_chats) > 0:
        # Handle eval chat
        async for token in _handle_eval_chat(eval_chats, session):
            yield token
    else:
        raise ValueError(f"No eval chats found with IDs: {eval_chat_ids}")


async def _handle_eval_chat(
    chats: List[EvalChats], session: Session
) -> AsyncGenerator[str, None]:
    """Handle eval chat processing."""

    # check that length is greater than 1
    if len(chats) < 2:
        raise ValueError("At least 2 chats are required")
    
    # pick an arbitrary chat to get the eval run id
    chat = chats[0]

    # Get the eval run (all chats have the same eval run id)
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
    # get the query agent
    query_agent = session.exec(select(Agents).where(Agents.id == eval_run.query_agent_id)).one()
    if not query_agent:
        raise ValueError(f"Query agent not found for eval run {eval_run.id}")
    
    # Get the agent from the eval run
    response_agent = session.exec(select(Agents).where(Agents.id == eval_run.agent_id)).one()
    if not response_agent:
        raise ValueError(f"Agent not found for eval run {eval_run.id}")
    
    # find out what turn it is by checking the length of eval messages, of just the chat
    eval_messages = session.exec(
        select(EvalMessages).where(EvalMessages.chat_id == chat.id)
    ).one_or_none()
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
        .order_by(EvalMessages.created_at)
    ).all()

    # Prepare conversation history - need to adapt for eval messages
    conversation_history = get_eval_conversation_history(messages)

    # Get scenario info for context
    scenario = session.exec(
        select(Scenarios).where(Scenarios.id == eval_run.scenario_id)
    ).one()
    scenario_context = f"Scenario: {scenario.name} - {scenario.description}"

    # Get class info
    class_info = get_class_info(eval_run.class_id, session)

    input_items = [scenario_context, class_info] + conversation_history

    # if turn_number is even, use the query agent, otherwise use the response agent
    if turn_number % 2 == 0:
        agent = query_agent
    else:
        agent = response_agent

    # Define the agent with agent-specific behavior
    agent_instance = AdvancedAgent(
        agent_name=agent.name,
        agent_prompt=agent.system_prompt,
        agent_type=agent.agent_type,
        temperature=agent.temperature,
    )

    result = Runner.run_streamed(
        agent_instance.agent(),
        input=input_items,
        run_config=RunConfig(workflow_name=chat.title),
    )

    # Process streaming events
    full_response = ""
    async for event in result.stream_events():
        if event.type == "raw_response_event":
            if isinstance(event.data, ResponseTextDeltaEvent):
                chunk = event.data.delta
                full_response += chunk
                yield chunk


    # process the final output
    final_output = result.final_output_as(ParallelOutput)
    # check that the length of the final output is the same as the length of the chat_ids
    if len(final_output.outputs) != len(chats):
        raise ValueError("The length of the final output is not the same as the length of the chat_ids")
    
    for output, chat in zip(final_output.outputs, chats):
        # create a new message with the output
        message = EvalMessages(chat_id=chat.id, content=output, type="response" if turn_number % 2 == 0 else "query")
        session.add(message)
        session.commit()

class ParallelOutput(BaseModel):
    outputs: List[str]


class AdvancedAgent:
    def __init__(
        self,
        agent_name: str,
        agent_prompt: str,
        agent_type: str,
        temperature: float = 0.0,
    ):
        self.gemini_client = get_gemini()
        self.agent_name = agent_name
        self.agent_prompt = agent_prompt
        if agent_type == "ta":
            self.system_prompt = gta_prompt(agent_name, agent_prompt)
        elif agent_type == "student":
            self.system_prompt = student_prompt(agent_name, agent_prompt)
        else:
            self.system_prompt = agent_prompt
        self.temperature = temperature

    def agent(self):
        return Agent(
            name=f"{self.agent_name} Agent",
            instructions=self.system_prompt,
            model=OpenAIChatCompletionsModel(
                model="gemini-2.5-flash-preview-04-17",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=self.temperature,
                include_usage=True,
                reasoning=Reasoning(effort="low"),
            ),
            output_type=ParallelOutput
        )