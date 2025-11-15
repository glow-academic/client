"""Create the internal agent that powers the guardrail from context data."""

import logging
from typing import Any

from agents import (FunctionToolResult, RunContextWrapper,
                    ToolsToFinalOutputResult)
from app.main import guardrail_progress
from app.utils.agents.generic_agent import GenericAgent

logger = logging.getLogger(__name__)


def build_guardrail_agent(
    context: dict[str, Any], guardrail_tools: list[Any]
) -> GenericAgent:
    """Create the internal agent that powers the guardrail from context data.

    Args:
        context: Dict containing agent, model, and provider data from service layer
        guardrail_tools: List of guardrail tools to use (created by caller)

    Returns:
        GenericAgent configured for guardrail evaluation
    """

    # Create tool use behavior to wait for evaluation tool to be called
    def tool_use_behavior(
        tool_context: RunContextWrapper[Any],
        tool_results: list[FunctionToolResult],
    ) -> ToolsToFinalOutputResult:
        # Check if evaluation tool has been called
        evaluation_complete = guardrail_progress.get("evaluation", False)
        logger.info(
            f"Tool use behavior check: evaluation_complete={evaluation_complete}"
        )
        return ToolsToFinalOutputResult(is_final_output=evaluation_complete)

    return GenericAgent(
        agent_name=context["agent_name"],
        system_prompt=context["system_prompt"],
        temperature=context["temperature"],
        model_name=context["model_name"],
        model_provider=context["provider_name"],
        base_url=context["base_url"],
        api_key=context["api_key"],
        reasoning=context["reasoning"],
        custom_model=context["custom_model"],
        tools=guardrail_tools,
        parallel_tool_calls=False,
        tool_use_behavior=tool_use_behavior,
    )
