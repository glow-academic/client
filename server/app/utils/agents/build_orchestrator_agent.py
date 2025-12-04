"""Build orchestrator agent with persona tools for voice mode."""

from typing import Any

from agents import (FunctionToolResult, RunContextWrapper,
                    ToolsToFinalOutputResult)
from app.utils.agents.generic_agent import GenericAgent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


def build_orchestrator_agent(
    context: dict[str, Any], persona_tools: list[Any]
) -> GenericAgent:
    """Create the orchestrator agent with persona tools.

    The orchestrator agent decides which persona should respond by calling
    the appropriate persona tool (e.g., speak_persona1name).

    Args:
        context: Context dict with agent, model, and provider data
        persona_tools: List of persona speech tools (created by caller)

    Returns:
        GenericAgent instance configured as orchestrator
    """
    # Create tool use behavior - orchestrator must call persona tools
    # Never respond directly, always use tools
    def tool_use_behavior(
        tool_context: RunContextWrapper[Any],
        tool_results: list[FunctionToolResult],
    ) -> ToolsToFinalOutputResult:
        # Check if any persona tool has been called
        persona_tool_called = any(
            result.name.startswith("speak_") for result in tool_results
        )

        logger.info(
            f"Orchestrator tool use check: persona_tool_called={persona_tool_called}, "
            f"tool_results_count={len(tool_results)}"
        )

        # If a persona tool was called, we're done (persona will handle response)
        # Otherwise, continue to allow orchestrator to call a tool
        return ToolsToFinalOutputResult(is_final_output=persona_tool_called)

    # Build orchestrator system prompt
    persona_names = [tool.name.replace("speak_", "").replace("_", " ") for tool in persona_tools]
    orchestrator_prompt = f"""You are an orchestrator managing a multi-party conversation.

Available personas:
{chr(10).join(f"- {name}" for name in persona_names)}

Your role:
- Listen to the user's input
- Decide which persona should respond based on the context
- Call the appropriate persona tool (speak_{{persona_name}}) to make that persona respond
- Never respond directly - always use a persona tool

When a persona tool is called, that persona will generate and speak the response.
You should call exactly one persona tool per user message."""

    return GenericAgent(
        agent_name="Orchestrator",
        system_prompt=orchestrator_prompt,
        temperature=context.get("temperature", 0.7),
        model_name=context["model_name"],
        model_provider=context["provider_name"],
        base_url=context.get("base_url"),
        reasoning=context.get("reasoning"),
        api_key=context["api_key"],
        tools=persona_tools,
        parallel_tool_calls=False,  # Call one persona at a time
        tool_use_behavior=tool_use_behavior,
    )

