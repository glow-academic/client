"""Create the hint generation agent from context data."""

from typing import Any

from agents import FunctionToolResult, RunContextWrapper, ToolsToFinalOutputResult

# Note: Progress checking in tool_use_behavior is synchronous, but storage is async
# For now, we'll check progress after tool execution completes
# This is a limitation of the current tool_use_behavior pattern
from app.infra.v3.agents.generic_agent import GenericAgent
from utils.logging.db_logger import get_logger

logger = get_logger(__name__)


def build_hint_agent(context: dict[str, Any], hint_tools: list[Any]) -> GenericAgent:
    """Create the hint generation agent from context data.

    Args:
        context: Context dict with agent, model, and provider data
        hint_tools: List of hint tools to use (created by caller)

    Returns:
        GenericAgent instance configured for hint generation
    """

    # Create tool use behavior - require at least 3 hints to be created
    # Note: Progress checking happens synchronously, but storage is async
    # For now, we'll check progress after tool execution completes
    def tool_use_behavior(
        tool_context: RunContextWrapper[Any],
        tool_results: list[FunctionToolResult],
    ) -> ToolsToFinalOutputResult:
        # Count create_hint tool calls (can be called multiple times)
        hint_tool_count = 0
        for result in tool_results:
            # Try to get tool_name from result (may not always be present)
            tool_name = getattr(result, "tool_name", None)  # type: ignore[misc,attr-defined]
            if tool_name == "create_hint":
                hint_tool_count += 1

        all_hints_complete = hint_tool_count >= 3

        logger.info(
            f"Tool use behavior check: hint_tools_called={hint_tool_count}, "
            f"all_complete={all_hints_complete}, "
            f"tool_results_count={len(tool_results)}"
        )

        # Return False to continue until at least 3 hints are created
        return ToolsToFinalOutputResult(is_final_output=all_hints_complete)

    return GenericAgent(
        agent_name=context["agent_name"],
        system_prompt=context["system_prompt"],
        temperature=context["temperature"],
        model_name=context["model_name"],
        provider=context["provider"],
        base_url=context["base_url"],
        api_key=context["api_key"],
        reasoning=context["reasoning"],
        tools=hint_tools,
        parallel_tool_calls=True,  # Enable parallel execution
        tool_use_behavior=tool_use_behavior,
    )
