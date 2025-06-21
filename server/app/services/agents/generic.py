import uuid
from typing import AsyncGenerator

from agents import (Agent, ModelSettings, OpenAIChatCompletionsModel, Runner,
                    trace)
from agents.items import TResponseInputItem
from app.db import get_session
from app.extensions import get_gemini
from app.models import Agents
from fastapi import Depends
from openai.types import Reasoning
from openai.types.responses import ResponseTextDeltaEvent
from pydantic import BaseModel
from sqlmodel import Session, select


# this becomes main. Put those other in the files
async def run_generic_agent_bare(
    agent_id: uuid.UUID,
    input_items: list[TResponseInputItem],
    session: Session = Depends(get_session),
) -> AsyncGenerator[str, None]:
    """
    This function is used to run the generic agent using the OpenAI Agents SDK.

    Args:
        agent_id: The ID of the agent
        input_text: Optional input text to send to the agent
    Yields:
        Text chunks from the agent's response
    """
    agent = session.exec(select(Agents).where(Agents.id == agent_id)).one()
    if not agent:
        raise ValueError(f"Agent with ID {agent_id} not found")

    agent_instance = GenericAgent(
        agent_name=agent.name,
        agent_prompt=agent.system_prompt,
        temperature=agent.temperature,
    )

    with trace(f"Testing {agent.name} Agent"):
        result = Runner.run_streamed(
            agent_instance.agent(),
            input=input_items,
        )

    async for event in result.stream_events():
        if event.type == "raw_response_event":
            if isinstance(event.data, ResponseTextDeltaEvent):
                chunk = event.data.delta
                yield chunk



class GenericAgent:
    def __init__(
        self,
        agent_name: str,
        agent_prompt: str,
        temperature: float = 0.0,
        output_type: type[BaseModel] | None = None,
    ):
        self.gemini_client = get_gemini()
        self.agent_name = agent_name
        self.agent_prompt = agent_prompt
        self.system_prompt = agent_prompt
        self.temperature = temperature
        self.output_type = output_type

    def agent(self) -> Agent:
        if self.gemini_client is None:
            raise ValueError("Gemini client is not set")
        
        return Agent(
            name=f"{self.agent_name} Agent",
            instructions=self.system_prompt,
            model=OpenAIChatCompletionsModel(
                model="gemini-2.5-flash-preview-05-20",
                openai_client=self.gemini_client,
            ),
            model_settings=ModelSettings(
                temperature=self.temperature,
                include_usage=True,
                reasoning=Reasoning(effort="low"),
            ),
            output_type=self.output_type,
        )
