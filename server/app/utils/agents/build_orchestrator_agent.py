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
        # FunctionToolResult may have 'name' attribute at runtime (from agents library)
        persona_tool_called = False
        for result in tool_results:
            # Access name attribute dynamically since type checker doesn't see it
            tool_name = getattr(result, "name", None)  # type: ignore[misc]
            if tool_name and isinstance(tool_name, str) and tool_name.startswith("speak_"):
                persona_tool_called = True
                break

        logger.info(
            f"Orchestrator tool use check: persona_tool_called={persona_tool_called}, "
            f"tool_results_count={len(tool_results)}"
        )

        # If a persona tool was called, we're done (persona will handle response)
        # Otherwise, continue to allow orchestrator to call a tool
        return ToolsToFinalOutputResult(is_final_output=persona_tool_called)

    # Build orchestrator system prompt
    # List actual tool names (e.g., "speak_passive") not template strings
    persona_names = [tool.name.replace("speak_", "").replace("_", " ") for tool in persona_tools]
    actual_tool_names = [tool.name for tool in persona_tools]
    
    # Build explicit tool usage instructions
    tool_usage_examples = ""
    if actual_tool_names:
        if len(actual_tool_names) == 1:
            tool_usage_examples = f"Use the tool: {actual_tool_names[0]}"
        else:
            tool_usage_examples = f"Use one of these tools: {', '.join(actual_tool_names)}"
    
    orchestrator_prompt = f"""You are an orchestrator managing a multi-party conversation.

Available personas:
{chr(10).join(f"- {name}" for name in persona_names)}

CRITICAL: You have access to these persona tools. You MUST use one of these EXACT tool names:
{chr(10).join(f"- {tool_name}" for tool_name in actual_tool_names)}

Your role:
- Listen to the user's input
- Decide which persona should respond based on the context
- Use the exact tool name from the list above (e.g., use "{actual_tool_names[0] if actual_tool_names else "speak_persona"}" not "callAssistant" or any other name)
- Never respond directly - always use a persona tool
- Never make up tool names - only use the exact tool names listed above

When a persona tool is used, that persona will generate and speak the response.
You must use exactly one persona tool per user message.

Example: To make the "{persona_names[0] if persona_names else "persona"}" persona respond, use the tool: {actual_tool_names[0] if actual_tool_names else "speak_persona"}"""

    return GenericAgent(
        agent_name="Orchestrator",
        system_prompt=orchestrator_prompt,
        temperature=context.get("temperature", 0.7),
        model_name=context["model_name"],
        provider=context["provider_name"],
        base_url=context.get("base_url"),
        reasoning=context.get("reasoning"),
        api_key=context["api_key"],
        tools=persona_tools,
        parallel_tool_calls=False,  # Call one persona at a time
        tool_use_behavior=tool_use_behavior,
    )

