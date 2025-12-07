"""Build voice agent with persona tools for voice mode."""

from typing import Any

from agents import (FunctionToolResult, RunContextWrapper,
                    ToolsToFinalOutputResult)
from app.utils.agents.generic_agent import DEBUG_INFO_TOOL_SUFFIX, GenericAgent
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


def build_voice_agent(
    context: dict[str, Any],
    persona_tools: list[Any],
    base_system_prompt: str,
    persona_instructions_map: dict[str, str],
) -> tuple[GenericAgent, str]:
    """Create the voice agent with persona tools and build complete instructions.

    The voice agent decides which persona should respond by calling
    the appropriate persona tool (e.g., speak_persona1name).

    Args:
        context: Context dict with agent, model, and provider data
        persona_tools: List of persona speech tools (created by caller)
        base_system_prompt: Base simulation prompt from agent (e.g., simulation-voice prompt)
        persona_instructions_map: Map of persona_name -> persona instructions

    Returns:
        Tuple of (GenericAgent instance, complete instructions string)
        The instructions string should be sent to RealtimeAgent's instructions field
    """
    # Create tool use behavior - voice agent must call persona tools
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
            f"Voice agent tool use check: persona_tool_called={persona_tool_called}, "
            f"tool_results_count={len(tool_results)}"
        )

        # If a persona tool was called, we're done (persona will handle response)
        # Otherwise, continue to allow voice agent to call a tool
        return ToolsToFinalOutputResult(is_final_output=persona_tool_called)

    # List actual tool names (e.g., "speak_passive") not template strings
    # Filter out non-persona tools (like debug_info) - only include tools that start with "speak_"
    persona_tools_only = [tool for tool in persona_tools if tool.name.startswith("speak_")]
    persona_names = [tool.name.replace("speak_", "").replace("_", " ") for tool in persona_tools_only]
    actual_tool_names = [tool.name for tool in persona_tools]  # Include all tools for tool usage instructions
    
    # Build persona descriptions with their instructions
    # Create a case-insensitive lookup map for persona instructions
    persona_instructions_lower = {k.lower(): v for k, v in persona_instructions_map.items()}
    
    persona_descriptions = []
    for persona_name in persona_names:
        # Try exact match first, then case-insensitive match
        instructions = persona_instructions_map.get(persona_name, "") or persona_instructions_lower.get(persona_name.lower(), "")
        if instructions:
            persona_descriptions.append(f"- {persona_name}: {instructions}")
        else:
            # Log warning if instructions not found
            logger.warning(
                f"Persona instructions not found for '{persona_name}'. "
                f"Available keys in map: {list(persona_instructions_map.keys())}"
            )
            persona_descriptions.append(f"- {persona_name}")
    
    # Build tool usage instructions
    # Only list persona tools (not debug_info) in the available tools list
    persona_tool_names_only = [tool.name for tool in persona_tools_only]
    tool_usage_section = f"""
Tool Usage Instructions:
- You MUST use one of these EXACT tool names to respond as a persona:
  {chr(10).join(f'  - {tool_name}' for tool_name in persona_tool_names_only)}
- Call exactly one tool per user message
- Never respond directly - always use a persona tool
- Never make up tool names - only use the exact tool names listed above

When a persona tool is used, that persona will generate and speak the response based on their personality described above.
"""
    
    # Build complete instructions: base_prompt + persona_list + tool_usage + debug_info
    complete_instructions = f"""{base_system_prompt}

---

Available Personas and Their Personalities:
{chr(10).join(persona_descriptions)}
{tool_usage_section}
{DEBUG_INFO_TOOL_SUFFIX}"""
    
    # Build minimal system prompt for GenericAgent (used internally, not sent to Realtime API)
    voice_agent_prompt = f"""You are a voice agent managing a multi-party conversation.

Available personas:
{chr(10).join(f"- {name}" for name in persona_names)}

CRITICAL: You have access to these persona tools. You MUST use one of these EXACT tool names:
{chr(10).join(f"- {tool_name}" for tool_name in persona_tool_names_only)}

Your role:
- Listen to the user's input
- Decide which persona should respond based on the context
- Use one of these EXACT tool names: {', '.join(persona_tool_names_only)}
- Never respond directly - always use a persona tool
- Never make up tool names - only use the exact tool names listed above

When a persona tool is used, that persona will generate and speak the response.
You must use exactly one persona tool per user message.

Example: To make the "{persona_names[0] if persona_names else "persona"}" persona respond, use the tool: {persona_tool_names_only[0] if persona_tool_names_only else "speak_persona"}"""

    agent = GenericAgent(
        agent_name="Voice Agent",
        system_prompt=voice_agent_prompt,
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
    
    return (agent, complete_instructions)

