"""Create persona speech tools for voice agent."""

import asyncio
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

import asyncpg  # type: ignore
from agents import Tool, function_tool
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from pydantic import Field

logger = get_logger(__name__)


def sanitize_persona_name(name: str) -> str:
    """Sanitize persona name for use in matching (case-insensitive)."""
    # Remove special characters, replace spaces with underscores, lowercase
    sanitized = "".join(c if c.isalnum() or c == " " else "" for c in name)
    sanitized = sanitized.replace(" ", "_").lower()
    return sanitized or "persona"


def find_persona_by_name(
    persona_name: str, personas: list[dict[str, Any]]
) -> tuple[uuid.UUID, str] | None:
    """Find persona by name (robust case-insensitive matching with whitespace handling).
    
    Args:
        persona_name: Name to search for (will be normalized)
        personas: List of persona dicts with 'persona_id'/'id' and 'persona_name'/'name' keys
        
    Returns:
        Tuple of (persona_id, persona_name) if found, None otherwise
    """
    # Normalize input: strip whitespace and handle empty strings
    if not persona_name or not persona_name.strip():
        return None
    
    persona_name_normalized = persona_name.strip()
    sanitized_search = sanitize_persona_name(persona_name_normalized)
    
    # Try exact matches first (case-insensitive)
    for persona in personas:
        # Handle both 'id'/'name' and 'persona_id'/'persona_name' field names
        persona_id_str = persona.get("persona_id") or persona.get("id")
        if not persona_id_str:
            continue
        
        persona_display_name = persona.get("persona_name") or persona.get("name", "")
        if not persona_display_name:
            continue
        
        # Try multiple matching strategies:
        # 1. Exact case-insensitive match (normalized)
        if persona_name_normalized.lower() == persona_display_name.lower():
            try:
                persona_id = uuid.UUID(str(persona_id_str))
                return (persona_id, persona_display_name)
            except (ValueError, TypeError):
                logger.warning(f"Invalid persona_id format: {persona_id_str}")
                continue
        
        # 2. Sanitized match (handles special characters)
        sanitized_persona = sanitize_persona_name(persona_display_name)
        if sanitized_search == sanitized_persona:
            try:
                persona_id = uuid.UUID(str(persona_id_str))
                return (persona_id, persona_display_name)
            except (ValueError, TypeError):
                logger.warning(f"Invalid persona_id format: {persona_id_str}")
                continue
    
    # If no exact match found, try fuzzy matching (contains check)
    # This helps if the model provides a partial name or slightly different wording
    for persona in personas:
        persona_id_str = persona.get("persona_id") or persona.get("id")
        if not persona_id_str:
            continue
        
        persona_display_name = persona.get("persona_name") or persona.get("name", "")
        if not persona_display_name:
            continue
        
        # Check if the search term is contained in the persona name (case-insensitive)
        if persona_name_normalized.lower() in persona_display_name.lower():
            try:
                persona_id = uuid.UUID(str(persona_id_str))
                logger.info(
                    f"Fuzzy matched persona '{persona_name_normalized}' to '{persona_display_name}'"
                )
                return (persona_id, persona_display_name)
            except (ValueError, TypeError):
                logger.warning(f"Invalid persona_id format: {persona_id_str}")
                continue
    
    return None


def create_persona_tools(
    personas: list[dict[str, Any]],
    chat_id: uuid.UUID,
    conn: asyncpg.Connection,
    run_id: uuid.UUID,
    emit_new_message_func: Callable[[dict[str, Any]], Awaitable[None]],
    emit_token_func: Callable[[dict[str, Any]], Awaitable[None]],
    emit_complete_func: Callable[[dict[str, Any]], Awaitable[None]],
    parent_message_id: uuid.UUID | None = None,
) -> list[Tool]:
    """Create a single speak tool for all personas in a scenario.

    Args:
        personas: List of persona dicts with 'persona_id'/'id' and 'persona_name'/'name' keys
        chat_id: UUID of the chat
        conn: Database connection
        run_id: UUID of the model run
        emit_new_message_func: Function to emit simulation_new_message events
        emit_token_func: Function to emit simulation_message_token events
        emit_complete_func: Function to emit simulation_message_complete events
        parent_message_id: Optional parent message ID for message tree branching

    Returns:
        List containing a single speak tool
    """
    chat_id_str = str(chat_id)
    
    # Build list of available persona names for tool description
    persona_names = []
    for persona in personas:
        persona_name = persona.get("persona_name") or persona.get("name", "")
        if persona_name:
            persona_names.append(persona_name)
    
    # Build formatted list of available personas for tool description
    if persona_names:
        persona_names_str = ", ".join(f'"{name}"' for name in persona_names)
        persona_description = (
            f"The name of the persona that should speak. "
            f"Must be one of: {persona_names_str}. "
            f"Case-insensitive matching is supported, but use the exact name when possible."
        )
    else:
        persona_names_str = "available personas"
        persona_description = (
            f"The name of the persona that should speak. "
            f"Available personas will be listed in the system instructions."
        )
    
    async def speak(
        persona: str = Field(
            description=persona_description,
        ),
        message: str = Field(
            description="The message content that the persona should say.",
        ),
    ) -> str:
        """Make a persona speak by calling this tool with the persona name and message.

        Args:
            persona: The name of the persona that should speak (must match one of the available personas)
            message: The message content for the persona to say

        Returns:
            Confirmation that the persona has spoken
        """
        logger.info(
            f"Speak tool called: persona={persona}, message_length={len(message)}"
        )
        
        # Normalize persona name input (strip whitespace)
        persona_normalized = persona.strip() if persona else ""
        
        # Find persona by name
        persona_match = find_persona_by_name(persona_normalized, personas)
        if not persona_match:
            # Build helpful error message with available personas
            available_list = "\n".join(f"  - {name}" for name in persona_names)
            error_msg = (
                f"Persona '{persona_normalized}' not found. "
                f"Available personas:\n{available_list}\n\n"
                f"Please use the exact persona name from the list above (case-insensitive matching is supported)."
            )
            logger.error(error_msg)
            return f"Error: {error_msg}"
        
        persona_id, persona_display_name = persona_match
        persona_id_str = str(persona_id)
        
        logger.info(
            f"Matched persona '{persona}' to {persona_display_name} (ID: {persona_id_str})"
        )

        # Create assistant message immediately
        sql_create_message = load_sql("sql/v3/simulations/create_message.sql")
        assistant_message_row = await conn.fetchrow(
            sql_create_message, "assistant", "", False
        )
        assistant_message = {
            "id": assistant_message_row["id"],
            "created_at": assistant_message_row["created_at"],
        }

        # Link message to run via message_runs
        sql_link = load_sql("sql/v3/simulations/link_message_to_run.sql")
        await conn.execute(
            sql_link, str(assistant_message["id"]), str(run_id)
        )

        # Link message to persona
        sql_link_persona = load_sql(
            "sql/v3/simulations/link_message_to_persona.sql"
        )
        try:
            await conn.execute(
                sql_link_persona,
                str(assistant_message["id"]),
                persona_id_str,
            )
            logger.info(
                f"Linked message {assistant_message['id']} to persona {persona_id_str}"
            )
        except Exception as link_err:
            logger.warning(f"Failed to link message to persona: {link_err}")

        # Create branch from parent to this assistant message
        if parent_message_id:
            parent_id_str = str(parent_message_id)
            assistant_id_str = str(assistant_message["id"])
            # Prevent self-references (parent_id != child_id)
            if parent_id_str != assistant_id_str:
                sql_branch = load_sql("sql/v3/simulations/create_message_branch.sql")
                await conn.execute(
                    sql_branch,
                    parent_id_str,
                    assistant_id_str,
                )
                logger.info(
                    f"Created branch from message {parent_id_str} to assistant message {assistant_id_str}"
                )

        # Emit new message event (with persona_id)
        await emit_new_message_func(
            {
                "message_id": str(assistant_message["id"]),
                "chat_id": chat_id_str,
                "role": "assistant",
                "content": "",
                "completed": False,
                "created_at": assistant_message["created_at"].isoformat(),
                "persona_id": persona_id_str,
            }
        )

        # Stream message content token by token (artificial streaming)
        accumulated_content = ""
        words = message.split()
        for word in words:
            token = word + " "
            accumulated_content += token

            await emit_token_func(
                {
                    "message_id": str(assistant_message["id"]),
                    "chat_id": chat_id_str,
                    "token": token,
                    "accumulated_content": accumulated_content,
                }
            )
            # Small delay for smooth streaming (relatively fast)
            await asyncio.sleep(0.01)

        final_content = accumulated_content.strip()

        # Update message in database
        sql_update = load_sql("sql/v3/simulations/update_message_content.sql")
        await conn.execute(sql_update, final_content, str(assistant_message["id"]))

        # Complete message
        sql_complete = load_sql("sql/v3/simulations/complete_message.sql")
        await conn.execute(
            sql_complete, final_content, str(assistant_message["id"])
        )

        # Emit completion event
        await emit_complete_func(
            {
                "message_id": str(assistant_message["id"]),
                "chat_id": chat_id_str,
                "final_content": final_content,
            }
        )

        # Emit updated message with completed=True (with persona_id)
        await emit_new_message_func(
            {
                "message_id": str(assistant_message["id"]),
                "chat_id": chat_id_str,
                "role": "assistant",
                "content": final_content,
                "completed": True,
                "created_at": assistant_message["created_at"].isoformat(),
                "persona_id": persona_id_str,
            }
        )

        logger.info(
            f"Streamed persona message from persona_id={persona_id_str} for chat {chat_id_str}"
        )
        return f"{persona_display_name} has responded"

    # Create single speak tool
    speak_tool = function_tool(speak)
    logger.info(f"Created speak tool for {len(personas)} persona(s)")
    return [speak_tool]

