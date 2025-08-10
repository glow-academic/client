from typing import Any

from agents import Agent, ModelSettings, Runner, trace
from agents.extensions.models.litellm_model import LitellmModel
from agents.mcp.server import MCPServer
from app.utils.auth import decrypt_api_key
from openai.types import Reasoning
from pydantic import BaseModel


class GenericAgent:
    def __init__(
        self,
        agent_name: str,
        system_prompt: str,
        temperature: float,
        model_name: str,
        model_provider: str,
        api_key: str,
        base_url: str | None,
        reasoning: str | None,
        output_type: type[BaseModel] | None = None,
        mcp_servers: list[MCPServer] | None = None,
        output_guardrails: list[Any] | None = None,
    ):
        self.agent_name = agent_name
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.model = model_provider + "/" + model_name
        self.output_type = output_type
        self.mcp_servers = mcp_servers
        self.output_guardrails: list[Any] = output_guardrails or []
        self.base_url = base_url

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
                base_url=self.base_url,
            ),
            model_settings=ModelSettings(
                temperature=self.temperature,
                include_usage=True,
                reasoning=self.reasoning,
            ),
            output_type=self.output_type,
            mcp_servers=self.mcp_servers or [],
            output_guardrails=self.output_guardrails,  # type: ignore[arg-type]
        )
