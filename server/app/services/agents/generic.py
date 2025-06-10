from typing import AsyncGenerator, Literal
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Runner, RunConfig
from openai.types import Reasoning
from datetime import datetime
from app.extensions import get_gemini
from app.utils.chat import get_conversation_history, get_chat_scenario
from app.utils.classes import get_class_info
from app.db import get_session
from sqlmodel import Session, select
from app.models import SimulationMessages, SimulationChats, SimulationAttempts, Agents
from app.utils.agents import gta_prompt, student_prompt
from fastapi import Depends
from openai.types.responses import (
    ResponseTextDeltaEvent,
)


async def run_generic_agent(
    chat_id: str,
    input_text: str = "",
    test_data: bool = False,
    session: Session = Depends(get_session),
) -> AsyncGenerator[str, None]:
    """
    This function is used to run the generic agent using the OpenAI Agents SDK.
    Returns a streamable result that yields clean text chunks as they're generated.
    The agent behavior is customized based on the agent's description.

    Args:
        chat_id: The ID of the chat session
        input_text: Optional input text to send to the agent
        test_data: Whether to use test data
        agent_mode: "student" for GenericAgent, "gta" for GTAAgent
    Yields:
        Text chunks from the agent's response
    """

    # If test_data is True, stream back a dummy response
    if test_data:
        dummy_response = "This is a test response for debugging purposes. The agent is working correctly."

        # Add a new message with the dummy response
        message = SimulationMessages(chat_id=chat_id, query=input_text, response=dummy_response)
        session.add(message)
        session.commit()

        # Stream the dummy response character by character to simulate real streaming
        for char in dummy_response:
            yield char
        return

    # get the chat from the chat_id
    chat = session.exec(
        select(SimulationChats).where(SimulationChats.id == chat_id)
    ).one()

    # find attempt from chat_id
    attempt = session.exec(select(SimulationAttempts).where(SimulationAttempts.id == chat.attempt_id)).one()
    if not attempt:
        raise ValueError(f"Attempt not found for chat {chat_id}")

    # get the agent from the chat
    agent = session.exec(select(Agents).where(Agents.id == chat.agent_id)).one()
    if not agent:
        raise ValueError(f"Agent not found for chat {chat_id}")

    # add a new message with an empty response
    message = SimulationMessages(chat_id=chat_id, query=input_text, response="")
    session.add(message)

    # get all the messages for the chat_id, including the new one, order by created_at
    messages = session.exec(
        select(SimulationMessages)
        .where(SimulationMessages.chat_id == chat_id)
        .order_by(SimulationMessages.created_at)
    ).all()

    # prepare conversation history from chat_id
    conversation_history = get_conversation_history(messages)
    chat_scenario = get_chat_scenario(chat, session)
    class_info = get_class_info(attempt.class_id, session)

    input_items = [chat_scenario, class_info] + conversation_history

    # define the agent with agent-specific behavior based on mode
    agent_instance = GenericAgent(agent_name=agent.name, agent_prompt=agent.prompt, agent_type=agent.agent_type, temperature=agent.temperature)

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

    # update the message with the full response
    message.response = full_response
    session.add(message)
    session.commit()


class GenericAgent:
    def __init__(self, agent_name: str, agent_prompt: str, agent_type: str, temperature: float = 0.0):
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
        ) 