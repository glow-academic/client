import uuid
from typing import AsyncGenerator, Literal

from agents import (Agent, ModelSettings, OpenAIChatCompletionsModel, Runner,
                    trace)
from agents.extensions.models.litellm_model import LitellmModel
from agents.items import TResponseInputItem
from agents.mcp.server import MCPServer
from app.db import get_session
from app.models import Agents, Models, Providers
from app.utils.auth import decrypt_api_key
from fastapi import Depends
from openai.types import Reasoning
from openai.types.responses import ResponseTextDeltaEvent
from pydantic import BaseModel
from sqlmodel import Session, select


# this becomes main. Put those other in the files
async def run_generic_agent(
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
    
    # getting the model from the agent's model_id
    model = session.exec(select(Models).where(Models.id == agent.model_id)).one()
    if not model:
        raise ValueError(f"Model with ID {agent.model_id} not found")
    
    # getting the provider from the model's provider_id
    provider = session.exec(select(Providers).where(Providers.id == model.provider_id)).one()
    if not provider:
        raise ValueError(f"Provider with ID {model.provider_id} not found")

    agent_instance = GenericAgent(
        agent_name=agent.name,
        system_prompt=agent.system_prompt,
        temperature=agent.temperature,
        model_name=model.name,
        model_provider=provider.name,
        api_key=provider.api_key,
        reasoning=agent.reasoning,
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
        system_prompt: str,
        temperature: float,
        model_name: str,
        model_provider: str,
        api_key: str,
        reasoning: str | None,
        output_type: type[BaseModel] | None = None,
        mcp_servers: list[MCPServer] | None = None,
    ):
        self.agent_name = agent_name
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.model = model_provider + "/" + model_name
        self.output_type = output_type
        self.mcp_servers = mcp_servers

        # convert reasoning to the correct type
        if reasoning == "low":
            self.reasoning = Reasoning(effort="low")
        elif reasoning == "medium":
            self.reasoning = Reasoning(effort="medium")
        elif reasoning == "high":
            self.reasoning = Reasoning(effort="high")
        else:
            self.reasoning = Reasoning(effort=None)


        # decrypt the api key
        self.api_key = decrypt_api_key(api_key)
    
    def agent(self) -> Agent:
        return Agent(
            name=f"{self.agent_name} Agent",
            instructions=self.system_prompt,
            model=LitellmModel(
                model=self.model,
                api_key=self.api_key,
            ),
            model_settings=ModelSettings(
                temperature=self.temperature,
                include_usage=True,
                reasoning=self.reasoning,
            ),
            output_type=self.output_type,
            mcp_servers=self.mcp_servers or [],
        )
