"""Get conversation history for RealtimeSession in RealtimeItem format."""

from datetime import datetime
from typing import Any


def get_realtime_history(
    messages: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Get the conversation history for a given list of messages in RealtimeItem format.
    When there are multiple consecutive response messages, only the latest one is kept.
    Error messages (prefixed with "Error:") are excluded from the conversation history.

    Args:
        messages: List of Messages objects from the database

    Returns:
        List of RealtimeItem objects formatted for RealtimeSession.resetHistory()
        Format: [
            {
                "type": "message",
                "role": "user" | "assistant",
                "content": [{"type": "input_text" | "output_text", "text": str}],
                "status": "completed"
            },
            ...
        ]
    """
    realtime_history: list[dict[str, Any]] = []

    # Filter out error messages and make a list of all items
    items = [msg for msg in messages if not msg.get("content", "").startswith("Error:")]

    # Sort items by created_at
    items = sorted(items, key=lambda x: x.get("created_at", datetime.min))

    # Group messages by type to handle consecutive responses
    current_response_messages: list[dict[str, Any]] = []

    for item in items:
        msg_type = item.get("type", "")
        msg_content = item.get("content", "")
        # Handle both "role" field (from database) and "type" field (query/response)
        # Database messages have "role" field, but we also check "type" for compatibility
        msg_role = item.get("role", "")

        # Determine if this is a user message (query type or user role)
        is_user_message = (msg_type == "query") or (msg_role == "user")
        # Determine if this is an assistant message (response type or assistant role)
        is_assistant_message = (msg_type == "response") or (msg_role == "assistant")

        if is_user_message and msg_content != "":
            # If we have pending response messages, add the latest one
            if current_response_messages:
                latest_response = current_response_messages[-1]
                assistant_realtime_item: dict[str, Any] = {
                    "type": "message",
                    "role": "assistant",
                    "content": [
                        {
                            "type": "output_text",
                            "text": latest_response.get("content", ""),
                        }
                    ],
                    "status": "completed",
                }
                realtime_history.append(assistant_realtime_item)
                current_response_messages = []

            # Add the user message
            user_realtime_item: dict[str, Any] = {
                "type": "message",
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": msg_content,
                    }
                ],
                "status": "completed",
            }
            realtime_history.append(user_realtime_item)
        elif is_assistant_message and msg_content != "":
            # Collect response messages to find the latest one
            current_response_messages.append(item)

    # Handle any remaining response messages at the end
    if current_response_messages:
        latest_response = current_response_messages[-1]
        final_assistant_item: dict[str, Any] = {
            "type": "message",
            "role": "assistant",
            "content": [
                {
                    "type": "output_text",
                    "text": latest_response.get("content", ""),
                }
            ],
            "status": "completed",
        }
        realtime_history.append(final_assistant_item)

    return realtime_history
