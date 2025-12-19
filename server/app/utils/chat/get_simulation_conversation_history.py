"""Get conversation history for simulation messages."""

from datetime import datetime
from typing import Any

import asyncpg
from agents.items import TResponseInputItem

from app.utils.sql_helper import load_sql


async def _get_tool_calls_for_run(
    conn: asyncpg.Connection, run_id: str
) -> list[dict[str, Any]]:
    """Get tool calls for a run from database."""
    sql_get_tool_calls = load_sql("sql/v3/tool_calls/get_tool_calls_for_run.sql")
    rows = await conn.fetch(sql_get_tool_calls, run_id)
    return [dict(row) for row in rows]


def get_simulation_conversation_history(
    messages: list[dict[str, Any]],
    conn: asyncpg.Connection | None = None,
    run_id: str | None = None,
    include_message_numbers: bool = False,
) -> tuple[list[TResponseInputItem], dict[str, int]]:
    """
    Get the conversation history for a given list of messages.
    When there are multiple consecutive response messages, only the latest one is kept.
    Error messages (prefixed with "Error:") are excluded from the conversation history.
    If conn and run_id are provided, tool calls are reconstructed from database.

    Args:
        messages: List of Messages objects from the database
        conn: Optional database connection for querying tool calls
        run_id: Optional run_id for querying tool calls
        include_message_numbers: If True, prefix messages with sequential numbers [1], [2], etc.

    Returns:
        Tuple of (conversation_history, message_id_map) where message_id_map maps message_id -> number
    """
    conversation_history: list[TResponseInputItem] = []
    message_id_map: dict[str, int] = {}
    message_number = 1

    # Filter out error messages and make a list of all items
    items = [msg for msg in messages if not msg.get("content", "").startswith("Error:")]

    # sort items by created_at
    items = sorted(items, key=lambda x: x.get("created_at", datetime.min))

    # Group messages by type to handle consecutive responses
    current_response_messages: list[dict[str, Any]] = []

    for item in items:
        # Handle both "type" (legacy/test) and "role" (database) fields
        msg_type = item.get("type", "")
        msg_role = item.get("role", "")
        msg_content = item.get("content", "")
        message_id = item.get("id", "")

        # Check if this is a user message (type="query" or role="user")
        is_user_message = (
            msg_type == "query" or msg_role == "user"
        ) and msg_content != ""

        if is_user_message:
            # If we have pending response messages, add the latest one
            if current_response_messages:
                latest_response = current_response_messages[-1]
                response_id = latest_response.get("id", "")
                content = latest_response.get("content", "")

                if include_message_numbers:
                    content = f"[{message_number}] {content}"
                    if response_id:
                        message_id_map[response_id] = message_number
                    message_number += 1

                assistant_message_item: TResponseInputItem = {
                    "role": "assistant",
                    "content": content,
                }
                conversation_history.append(assistant_message_item)
                current_response_messages = []

            # Add the user message
            content = msg_content
            if include_message_numbers:
                content = f"[{message_number}] {content}"
                if message_id:
                    message_id_map[message_id] = message_number
                message_number += 1

            user_message_item: TResponseInputItem = {
                "role": "user",
                "content": content,
            }
            conversation_history.append(user_message_item)
        # Check if this is an assistant message (type="response" or role="assistant")
        elif (msg_type == "response" or msg_role == "assistant") and msg_content != "":
            # Collect response messages to find the latest one
            current_response_messages.append(item)

    # Handle any remaining response messages at the end
    if current_response_messages:
        latest_response = current_response_messages[-1]
        response_id = latest_response.get("id", "")
        content = latest_response.get("content", "")

        if include_message_numbers:
            content = f"[{message_number}] {content}"
            if response_id:
                message_id_map[response_id] = message_number
            message_number += 1

        current_assistant_message_item: TResponseInputItem = {
            "role": "assistant",
            "content": content,
        }
        conversation_history.append(current_assistant_message_item)

    return conversation_history, message_id_map


async def get_simulation_conversation_history_with_tool_calls(
    messages: list[dict[str, Any]],
    conn: asyncpg.Connection,
    run_id: str,
    include_message_numbers: bool = False,
) -> tuple[list[TResponseInputItem], dict[str, int]]:
    """
    Get conversation history with tool calls reconstructed from database.

    Args:
        messages: List of Messages objects from the database
        conn: Database connection for querying tool calls
        run_id: Run ID for querying tool calls
        include_message_numbers: If True, prefix messages with sequential numbers [1], [2], etc.

    Returns:
        Tuple of (conversation_history, message_id_map) where message_id_map maps message_id -> number
    """
    # Get base conversation history
    conversation_history, message_id_map = get_simulation_conversation_history(
        messages, include_message_numbers=include_message_numbers
    )

    # Get tool calls for this run
    tool_calls_data = await _get_tool_calls_for_run(conn, run_id)

    if not tool_calls_data:
        return conversation_history

    # Reconstruct conversation history with tool calls
    # Tool calls appear as assistant messages with tool_calls array, followed by tool result messages
    reconstructed_history: list[TResponseInputItem] = list(conversation_history)

    # Sort tool calls by creation time
    tool_calls_sorted = sorted(
        tool_calls_data,
        key=lambda x: x.get("tool_call_created_at", datetime.min)
        if isinstance(x.get("tool_call_created_at"), datetime)
        else datetime.min,
    )

    # Add tool calls to the conversation history
    for tc in tool_calls_sorted:
        # Only add tool calls that have arguments (completed tool calls)
        if not tc.get("arguments_raw"):
            continue

        # Create assistant message with tool_calls
        assistant_with_tool_calls: TResponseInputItem = {
            "role": "assistant",
            "content": None,  # Tool calls don't have content
            "tool_calls": [  # type: ignore[assignment]
                {
                    "id": tc["call_id"],
                    "type": "function",
                    "function": {
                        "name": tc["tool_name"],
                        "arguments": tc["arguments_raw"],
                    },
                }
            ],
        }
        reconstructed_history.append(assistant_with_tool_calls)

        # Add tool result message if result exists
        if tc.get("result_content"):
            tool_result: TResponseInputItem = {
                "role": "tool",  # type: ignore[assignment]
                "content": tc["result_content"],
                "tool_call_id": tc["call_id"],  # type: ignore[assignment]
            }
            reconstructed_history.append(tool_result)

    return reconstructed_history, message_id_map
