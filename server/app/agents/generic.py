from typing import AsyncGenerator
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Runner, RunConfig
from openai.types import Reasoning
from app.extensions import get_gemini
from app.utils.chat import get_conversation_history, get_chat_scenario
from app.utils.classes import get_class_info
from app.db import get_session
from sqlmodel import Session, select
from app.models import Messages, Chats, Attempts, Agents
from fastapi import Depends
from openai.types.responses import (
    ResponseTextDeltaEvent,
)


async def run_generic_agent(
    chat_id: str, input_text: str = "", test_data: bool = False, session: Session = Depends(get_session)
) -> AsyncGenerator[str, None]:
    """
    This function is used to run the generic agent using the OpenAI Agents SDK.
    Returns a streamable result that yields clean text chunks as they're generated.
    The agent behavior is customized based on the agent's description.

    Args:
        chat_id: The ID of the chat session
        input_text: Optional input text to send to the agent
        test_data: Whether to use test data
    Yields:
        Text chunks from the agent's response
    """

    # If test_data is True, stream back a dummy response
    if test_data:
        dummy_response = "This is a test response for debugging purposes. The agent is working correctly."
        
        # Add a new message with the dummy response
        message = Messages(chat_id=chat_id, query=input_text, response=dummy_response)
        session.add(message)
        session.commit()
        
        # Stream the dummy response character by character to simulate real streaming
        for char in dummy_response:
            yield char
        return

    # get the chat from the chat_id
    chat = session.exec(select(Chats).where(Chats.id == chat_id)).one()

    # find attempt from chat_id
    attempt = session.exec(select(Attempts).where(Attempts.id == chat.attempt_id)).one()
    if not attempt:
        raise ValueError(f"Attempt not found for chat {chat_id}")

    # get the agent from the chat
    agent = session.exec(select(Agents).where(Agents.id == chat.agent_id)).one()
    if not agent:
        raise ValueError(f"Agent not found for chat {chat_id}")

    # add a new message with an empty response
    message = Messages(chat_id=chat_id, query=input_text, response="")
    session.add(message)

    # get all the messages for the chat_id, including the new one, order by created_at
    messages = session.exec(
        select(Messages)
        .where(Messages.chat_id == chat_id)
        .order_by(Messages.created_at)
    ).all()

    # prepare conversation history from chat_id
    conversation_history = get_conversation_history(messages)
    chat_scenario = get_chat_scenario(chat, session)
    class_info = get_class_info(attempt.class_id, session)

    input_items = [chat_scenario, class_info] + conversation_history

    # define the agent with agent-specific behavior
    generic_agent = GenericAgent(agent_name=agent.name, agent_prompt=agent.prompt)

    result = Runner.run_streamed(
        generic_agent.agent(),
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
    def __init__(self, agent_name: str, agent_prompt: str):
        self.gemini_client = get_gemini()
        self.agent_name = agent_name
        self.agent_prompt = agent_prompt
        self.system_prompt = (
            f"Your only purpose is to prepare a Graduate Level Teaching Assistant on how to interact with a {agent_name} student, so I need you to truly embrace this role."
            f"{agent_prompt}"
            "You will be given a scenario, and you will need to do your best to respond to the student in a way that is appropriate for the scenario."
            "This training for Graduate Level Teaching Assistant is very important because they need to learn how to deal with different types of students in various situations. "
            "Remember that you are a student, not an AI, so keep conversations natural, concise, and engaging, don't say unnecessary information just for the sake of having more words. "
            "Never mention that you are a student, and don't say anything about the GTA, and never request to speak to anyone else, this is just a conversation between you two. "
            "Don't use any big or unusual words or phrases, keep your language simple and straightforward. "
            "Formatting Instructions: "
            "- For code snippets, use standard Markdown code blocks with the appropriate language identifier (e.g., ```python ... ``` or ```c++ ... ```). "
            "- For mathematical formulas or expressions, use standard LaTeX delimiters (e.g., $...$ for inline math, and $$...$$ for display math). "
            "- Avoid using LaTeX commands to format entire code blocks."
        )

        # unused, but can integrate if needed
        self.GENERATION_CONFIG = {
            "temperature": 0.7,
            "top_p": 1,
            "top_k": 1,
            "max_output_tokens": 2048,
        }

        self.SAFETY_SETTINGS = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_ONLY_HIGH",
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_ONLY_HIGH",
            },
        ]

    def agent(self):
        return Agent(
            name=f"{self.agent_name} Agent",
            instructions=self.system_prompt,
            model=OpenAIChatCompletionsModel(
                model="gemini-2.5-flash-preview-04-17",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=0.0,
                include_usage=True,
                reasoning=Reasoning(effort="low"),
            ),
        ) 