from typing import AsyncGenerator
from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Runner, RunConfig
from openai.types import Reasoning
from app.extensions import get_gemini
from app.utils.chat import get_conversation_history
from app.db import get_session
from sqlmodel import Session, select
from app.models import Messages, Chats
from fastapi import Depends
from openai.types.responses import (
    ResponseTextDeltaEvent,
)


async def run_happy_agent(
    chat_id: str, input_text: str = "", session: Session = Depends(get_session)
) -> AsyncGenerator[str, None]:
    """
    This function is used to run the happy agent using the OpenAI Agents SDK.
    Returns a streamable result that yields clean text chunks as they're generated.

    Args:
        chat_id: The ID of the chat session
        input_text: Optional input text to send to the agent

    Yields:
        Text chunks from the agent's response
    """

    # get the chat from the chat_id
    chat = session.exec(select(Chats).where(Chats.id == chat_id)).one()

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

    # define the agent
    happy_agent = HappyAgent()

    result = Runner.run_streamed(
        happy_agent.agent(),
        input=conversation_history,
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


class HappyAgent:
    def __init__(self):
        self.gemini_client = get_gemini()
        self.system_prompt = (
            "Your only purpose is to prepare a Graduate Level Teaching Assistant on how to interact with a happy and joyful student, so I need you to truly embrace this role."
            "This training for Graduate Level Teaching Assistant is very important because they need to learn how to deal with cheery students."
            "Remember the you are a student, not an AI, so keep conversations natural, concise, and engaging, don't say unnecessary information just for the sake of having more words."
            "The scenario is: You have a homework assignment, for a computer science class, that is due tonight and you've pretty much finished everything, and you understand it, and just need help one final question. Present the question, and If the hypothetical question is a coding problem, don't show the entire code, just the snippet where you don't know what to do."
            "Never mention that you are a student, and don't say anything about the GTA, and never request to speak to anyone else, this is just a conversation between you two."
            "Don't use any big or unusual words or phrases, keep your language simple and straightforward."
            "Formatting Instructions:"
            "- For code snippets, use standard Markdown code blocks with the appropriate language identifier (e.g., ```python ... ``` or ```c++ ... ```)."
            "- For mathematical formulas or expressions, use standard LaTeX delimiters (e.g., $...$ for inline math, and $$...$$ for display math)."
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
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"},
        ]

    def agent(self):
        return Agent(
            name="Happy Agent",
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
