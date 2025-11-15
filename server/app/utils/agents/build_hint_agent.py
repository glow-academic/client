"""Create the hint generation agent from context data."""

import logging
from typing import Any

from agents import ToolsToFinalOutputResult
from app.utils.agents.generic_agent import GenericAgent
from app.main import hint_progress

logger = logging.getLogger(__name__)


def build_hint_agent(context: dict[str, Any], hint_tools: list[Any]) -> GenericAgent:
    """Create the hint generation agent from context data.

    Args:
        context: Context dict with agent, model, and provider data
        hint_tools: List of hint tools to use (created by caller)

    Returns:
        GenericAgent instance configured for hint generation
    """

    # Create tool use behavior - require all 3 hint tools to be called
    def tool_use_behavior(
        tool_context: Any, tool_results: list[Any]
    ) -> ToolsToFinalOutputResult:
        # Check if all three hint tools have been called
        hint_1_complete = hint_progress.get("hint_1", False)
        hint_2_complete = hint_progress.get("hint_2", False)
        hint_3_complete = hint_progress.get("hint_3", False)

        all_hints_complete = hint_1_complete and hint_2_complete and hint_3_complete

        logger.info(
            f"Tool use behavior check: hint_1={hint_1_complete}, "
            f"hint_2={hint_2_complete}, hint_3={hint_3_complete}, "
            f"all_complete={all_hints_complete}, "
            f"tool_results_count={len(tool_results)}"
        )

        # Return False to continue until all 3 hints are provided
        return ToolsToFinalOutputResult(is_final_output=all_hints_complete)

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
        tools=hint_tools,
        parallel_tool_calls=True,  # Enable parallel execution
        tool_use_behavior=tool_use_behavior,
    )

