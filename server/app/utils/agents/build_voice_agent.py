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
    the `speak` tool with the persona name and message.

    Args:
        context: Context dict with agent, model, and provider data
        persona_tools: List containing the single speak tool (created by caller)
        base_system_prompt: Base simulation prompt from agent (e.g., simulation-voice prompt)
        persona_instructions_map: Map of persona_name -> persona instructions

    Returns:
        Tuple of (GenericAgent instance, complete instructions string)
        The instructions string should be sent to RealtimeAgent's instructions field
    """
    # Create tool use behavior - voice agent must call the speak tool
    # Never respond directly, always use tools
    def tool_use_behavior(
        tool_context: RunContextWrapper[Any],
        tool_results: list[FunctionToolResult],
    ) -> ToolsToFinalOutputResult:
        # Check if the speak tool has been called
        # FunctionToolResult may have 'name' attribute at runtime (from agents library)
        persona_tool_called = False
        for result in tool_results:
            # Access name attribute dynamically since type checker doesn't see it
            tool_name = getattr(result, "name", None)  # type: ignore[misc]
            if tool_name and isinstance(tool_name, str) and tool_name == "speak":
                persona_tool_called = True
                break

        logger.info(
            f"Voice agent tool use check: persona_tool_called={persona_tool_called}, "
            f"tool_results_count={len(tool_results)}"
        )

        # If the speak tool was called, we're done (persona will handle response)
        # Otherwise, continue to allow voice agent to call a tool
        return ToolsToFinalOutputResult(is_final_output=persona_tool_called)

    # Extract persona names from persona_instructions_map
    persona_names = list(persona_instructions_map.keys())
    
    # Build persona descriptions with their instructions
    persona_descriptions = []
    for persona_name in persona_names:
        instructions = persona_instructions_map.get(persona_name, "")
        if instructions:
            persona_descriptions.append(f"- {persona_name}: {instructions}")
        else:
            persona_descriptions.append(f"- {persona_name}")
    
    # Build list of available persona names for tool usage
    persona_names_list = [f'"{name}"' for name in persona_names]
    
    # Build tool usage instructions
    tool_usage_section = f"""
Tool Usage Instructions:
- You MUST use the `speak` tool to respond as a persona
- The `speak` tool takes two parameters:
  * `persona`: The name of the persona that should speak (must be one of: {', '.join(persona_names_list)})
  * `message`: The message content that the persona should say
- Call exactly one tool per user message
- Never respond directly - always use the `speak` tool
- The persona name must match exactly one of the available personas listed above

When the `speak` tool is used, the specified persona will generate and speak the response based on their personality described above.
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

CRITICAL: You have access to the `speak` tool. You MUST use it to make a persona respond.

Your role:
- Listen to the user's input
- Decide which persona should respond based on the context
- Use the `speak` tool with:
  * `persona`: The name of the persona (must be one of: {', '.join(persona_names_list)})
  * `message`: The message content for that persona to say
- Never respond directly - always use the `speak` tool
- The persona name must match exactly one of the available personas listed above

When the `speak` tool is used, the specified persona will generate and speak the response.
You must use exactly one `speak` tool call per user message.

Example: To make the "{persona_names[0] if persona_names else "persona"}" persona respond, call: speak(persona="{persona_names[0] if persona_names else "persona"}", message="your message here")"""

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

