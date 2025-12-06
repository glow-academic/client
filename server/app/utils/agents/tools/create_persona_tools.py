"""Create persona speech tools for orchestrator agent."""

import uuid
from typing import Any

import asyncpg  # type: ignore
from agents import Tool, function_tool
from pydantic import Field

from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


def sanitize_persona_name(name: str) -> str:
    """Sanitize persona name for use in tool name."""
    # Remove special characters, replace spaces with underscores, lowercase
    sanitized = "".join(c if c.isalnum() or c == " " else "" for c in name)
    sanitized = sanitized.replace(" ", "_").lower()
    # Ensure it starts with a letter
    if sanitized and not sanitized[0].isalpha():
        sanitized = "persona_" + sanitized
    return sanitized or "persona"


def create_persona_tool(
    persona_id: uuid.UUID,
    persona_name: str,
    chat_id: uuid.UUID,
    conn: asyncpg.Connection,
) -> Tool:
    """Create a tool for a specific persona to speak.

    Args:
        persona_id: UUID of the persona
        persona_name: Display name of the persona
        chat_id: UUID of the chat
        conn: Database connection

    Returns:
        Tool that can be called to make the persona speak
    """
    tool_name = f"speak_{sanitize_persona_name(persona_name)}"
    persona_id_str = str(persona_id)
    chat_id_str = str(chat_id)

    async def speak_persona(
        message: str = Field(
            description=f"Respond as {persona_name}. This is the message that {persona_name} will say.",
        ),
    ) -> str:
        """Make {persona_name} speak.

        When called, this will execute the persona agent and stream the response
        via WebSocket events (simulation_message_token, simulation_message_complete).

        Args:
            message: The message content for {persona_name} to say

        Returns:
            Confirmation that the persona has spoken
        """
        logger.info(
            f"Persona tool called: {tool_name} for persona {persona_name} (ID: {persona_id_str})"
        )
        # Store the tool call info for the realtime handler to process
        # The actual execution will happen in the realtime event handler
        # when it detects this tool call from OpenAI
        return f"{persona_name} will respond: {message[:100]}..."

    # Set unique function name
    speak_persona.__name__ = tool_name
    return function_tool(speak_persona)


def create_persona_tools(
    personas: list[dict[str, Any]],
    chat_id: uuid.UUID,
    conn: asyncpg.Connection,
) -> list[Tool]:
    """Create tools for all personas in a scenario.

    Args:
        personas: List of persona dicts with 'persona_id'/'id' and 'persona_name'/'name' keys
        chat_id: UUID of the chat
        conn: Database connection

    Returns:
        List of persona speech tools
    """
    tools = []
    for persona in personas:
        # Handle both 'id'/'name' and 'persona_id'/'persona_name' field names
        persona_id_str = persona.get("persona_id") or persona.get("id")
        if not persona_id_str:
            logger.error(f"Persona missing id field: {persona}")
            continue
        persona_id = uuid.UUID(str(persona_id_str))
        persona_name = persona.get("persona_name") or persona.get("name", "Unknown Persona")
        tool = create_persona_tool(persona_id, persona_name, chat_id, conn)
        tools.append(tool)
        logger.info(f"Created persona tool: {tool.name} for {persona_name}")

    logger.info(f"Created {len(tools)} persona tools")
    return tools

