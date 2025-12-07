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
    run_id: uuid.UUID,
    emit_new_message_func: Callable[[dict[str, Any]], Awaitable[None]],
    emit_token_func: Callable[[dict[str, Any]], Awaitable[None]],
    emit_complete_func: Callable[[dict[str, Any]], Awaitable[None]],
    parent_message_id: uuid.UUID | None = None,
) -> Tool:
    """Create a tool for a specific persona to speak.

    Args:
        persona_id: UUID of the persona
        persona_name: Display name of the persona
        chat_id: UUID of the chat
        conn: Database connection
        run_id: UUID of the model run
        emit_new_message_func: Function to emit simulation_new_message events
        emit_token_func: Function to emit simulation_message_token events
        emit_complete_func: Function to emit simulation_message_complete events
        parent_message_id: Optional parent message ID for message tree branching

    Returns:
        Tool that can be called to make the persona speak
    """
    tool_name = f"speak_{sanitize_persona_name(persona_name)}"
    persona_id_str = str(persona_id)
    chat_id_str = str(chat_id)

    async def speak_persona(
        message: str = Field(
            description=f"Respond as {persona_name}. Call this tool with your message.",
        ),
    ) -> str:
        """Respond as {persona_name}.

        Call this tool when you need {persona_name} to speak. Pass the message content as the 'message' parameter.

        Args:
            message: The message content for {persona_name} to say

        Returns:
            Confirmation that the persona has spoken
        """
        logger.info(
            f"Persona tool called: {tool_name} for persona {persona_name} (ID: {persona_id_str})"
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
        return f"{persona_name} has responded"

    # Set unique function name
    speak_persona.__name__ = tool_name
    return function_tool(speak_persona)


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
    """Create tools for all personas in a scenario.

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
        tool = create_persona_tool(
            persona_id,
            persona_name,
            chat_id,
            conn,
            run_id,
            emit_new_message_func,
            emit_token_func,
            emit_complete_func,
            parent_message_id,
        )
        tools.append(tool)
        logger.info(f"Created persona tool: {tool.name} for {persona_name}")

    logger.info(f"Created {len(tools)} persona tools")
    return tools

