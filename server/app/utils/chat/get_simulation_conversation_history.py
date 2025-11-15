"""Get conversation history for simulation messages."""

import json
from datetime import datetime
from typing import Any

from agents.items import TResponseInputItem


def get_simulation_conversation_history(
    messages: list[dict[str, Any]],
) -> list[TResponseInputItem]:
    """
    Get the conversation history for a given list of messages.
    When there are multiple consecutive response messages, only the latest one is kept.
    Error messages (prefixed with "Error:") are excluded from the conversation history.

    Args:
        messages: List of Messages objects from the database

    Returns:
        List of message objects formatted for OpenAI API consumption
    """
    conversation_history: list[TResponseInputItem] = []

    # Filter out error messages and make a list of all items
    items = [msg for msg in messages if not msg.get("content", "").startswith("Error:")]

    # sort items by created_at
    items = sorted(items, key=lambda x: x.get("created_at", datetime.min))

    # Group messages by type to handle consecutive responses
    current_response_messages: list[dict[str, Any]] = []

    for item in items:
        msg_type = item.get("type", "")
        msg_content = item.get("content", "")

        if msg_type == "query" and msg_content != "":
            # If we have pending response messages, add the latest one
            if current_response_messages:
                latest_response = current_response_messages[-1]
                assistant_message_item: TResponseInputItem = {
                    "role": "assistant",
                    "content": latest_response.get("content", ""),
                }
                conversation_history.append(assistant_message_item)
                current_response_messages = []

            # Add the user message
            user_message_item: TResponseInputItem = {
                "role": "user",
                "content": msg_content,
            }
            conversation_history.append(user_message_item)
        elif msg_type == "response" and msg_content != "":
            # Collect response messages to find the latest one
            current_response_messages.append(item)

    # Handle any remaining response messages at the end
    if current_response_messages:
        latest_response = current_response_messages[-1]
        current_assistant_message_item: TResponseInputItem = {
            "role": "assistant",
            "content": latest_response.get("content", ""),
        }
        conversation_history.append(current_assistant_message_item)

    return conversation_history
