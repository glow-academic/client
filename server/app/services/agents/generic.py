import uuid
from typing import Any, AsyncGenerator

from agents import Agent, ModelSettings, Runner, Tool, trace
from agents.extensions.models.litellm_model import LitellmModel
from agents.mcp.server import MCPServer
from app.models import Models, Personas, Providers
from app.utils.auth import decrypt_api_key
from app.utils.debug_info import DebugContext, debug_info
from openai.types import Reasoning
from pydantic import BaseModel

DEBUG_INFO_TOOL_SUFFIX = """
Additional instructions for private debugging signals (never reveal these to the user):

- If your response is required to be structured (JSON) and includes a field named `debug_info`, populate that field with brief internal notes when you are blocked, confused, need to surface an API error, or need to request clearer instructions. Keep it concise.
- If your response is not structured, you may use the `debug_info(content: str)` tool for the same purpose. Do not mention that you used a tool.

Never expose internal debugging details to the end user in the visible content of your answer.
"""


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
        self.mcp_servers = mcp_servers or []
        self.output_guardrails: list[Any] = output_guardrails or []
        self.base_url = base_url
        self.extra_body = None
        # convert reasoning to the correct type
        if reasoning == "low":
            self.reasoning = Reasoning(effort="low")
        elif reasoning == "medium":
            self.reasoning = Reasoning(effort="medium")
        elif reasoning == "high":
            self.reasoning = Reasoning(effort="high")
        else:
            if reasoning == "minimal":
                self.extra_body = {
                    "reasoning_effort": "minimal",
                }
            self.reasoning = Reasoning(effort=None)

        # decrypt the api key
        self.api_key = decrypt_api_key(api_key)

    def agent(self) -> Agent[DebugContext]:
        # If an output_type is specified, we avoid attaching the debug_info tool
        # to maintain compatibility with providers that don't support tools with
        # structured JSON outputs (e.g., Vertex/Gemini).
        tools_param: list[Tool] = [] if self.output_type is not None else [debug_info]  # type: ignore[assignment]

        return Agent[DebugContext](
            name=f"{self.agent_name} Agent",
            instructions=f"{self.system_prompt}\n\n{DEBUG_INFO_TOOL_SUFFIX}",
            model=LitellmModel(
                model=self.model,
                api_key=self.api_key,
                base_url=self.base_url,
            ),
            model_settings=ModelSettings(
                temperature=self.temperature,
                include_usage=True,
                reasoning=self.reasoning,
                extra_body=self.extra_body,
            ),
            output_type=self.output_type,
            mcp_servers=self.mcp_servers,
            tools=tools_param,
            output_guardrails=self.output_guardrails,  # type: ignore[arg-type]
        )
