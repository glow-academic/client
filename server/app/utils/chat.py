import json
import logging
from datetime import datetime
from typing import Any, Dict, List

import asyncpg  # type: ignore
from agents.items import TResponseInputItem
from openai.types.responses import ResponseFunctionToolCallParam

logger = logging.getLogger(__name__)


def get_simulation_conversation_history(
    messages: List[Dict[str, Any]],
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
    items = [msg for msg in messages if not msg.get('content', '').startswith("Error:")]

    # sort items by created_at
    items = sorted(items, key=lambda x: x.get('created_at', datetime.min))

    # Group messages by type to handle consecutive responses
    current_response_messages: List[Dict[str, Any]] = []
    
    for item in items:
        msg_type = item.get('type', '')
        msg_content = item.get('content', '')
        
        if msg_type == "query" and msg_content != "":
            # If we have pending response messages, add the latest one
            if current_response_messages:
                latest_response = current_response_messages[-1]
                assistant_message_item: TResponseInputItem = {
                    "role": "assistant",
                    "content": latest_response.get('content', ''),
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
            "content": latest_response.get('content', ''),
        }
        conversation_history.append(current_assistant_message_item)

    return conversation_history


def get_assistant_conversation_history(
    messages: List[Dict[str, Any]],
    tool_calls: List[Dict[str, Any]],
) -> list[TResponseInputItem]:
    """
    Get the conversation history for a given list of messages and tool calls,
    organized chronologically by creation time.

    Args:
        messages: List of message dicts from the database
        tool_calls: List of tool call dicts from the database

    Returns:
        List of message objects formatted for OpenAI API consumption,
        chronologically ordered
    """
    # Create a list of all conversation items with their timestamps
    conversation_items: List[Dict[str, Any]] = []

    # Add messages to the list
    for message in messages:
        if message.get('role') == "user" and message.get('content'):
            user_item: TResponseInputItem = {"role": "user", "content": message['content']}
            conversation_items.append(
                {"timestamp": message.get('created_at'), "type": "message", "item": user_item}
            )
        elif message.get('role') == "assistant" and message.get('content'):
            assistant_item: TResponseInputItem = {
                "role": "assistant",
                "content": message['content'],
            }
            conversation_items.append(
                {
                    "timestamp": message.get('created_at'),
                    "type": "message",
                    "item": assistant_item,
                }
            )

    # Add tool calls to the list
    for tool_call in tool_calls:
        # Add the tool call itself
        logger.info(f"Tool call arguments: {tool_call.get('tool_arguments')}")
        tool_call_item: ResponseFunctionToolCallParam = {
            "arguments": str(tool_call.get('tool_arguments'))
            if tool_call.get('tool_arguments')
            else json.dumps({}),
            "call_id": "call_" + str(tool_call.get('id')),
            "name": tool_call.get('tool_name', ''),
            "type": "function_call",
            "id": str(tool_call.get('id')),
            "status": "completed",
        }
        conversation_items.append(
            {
                "timestamp": tool_call.get('created_at'),
                "type": "tool_call",
                "item": tool_call_item,
            }
        )

        # Add the tool call output immediately after the tool call
        logger.info(f"Tool call result: {tool_call.get('tool_result')}")
        tool_call_output_item: TResponseInputItem = {
            "call_id": "call_" + str(tool_call.get('id')),
            "output": str(tool_call.get('tool_result'))
            if tool_call.get('tool_result')
            else json.dumps({}),
            "type": "function_call_output",
            "id": str(tool_call.get('id')),
            "status": "completed",
        }
        conversation_items.append(
            {
                "timestamp": tool_call.get('created_at'),
                "type": "tool_output",
                "item": tool_call_output_item,
            }
        )

    # Sort all items by timestamp
    conversation_items.sort(key=lambda x: x["timestamp"] or datetime.min)

    # Extract the conversation history in chronological order
    conversation_history: list[TResponseInputItem] = []
    for item in conversation_items:
        conversation_history.append(item["item"])

    logger.info(
        f"Chronologically ordered conversation history with {len(conversation_history)} items"
    )

    return conversation_history


def format_chat_scenario(problem_statement: str) -> TResponseInputItem:
    """
    Format a problem statement as a chat scenario message.
    
    Args:
        problem_statement: The scenario problem statement text
        
    Returns:
        Formatted message dict for chat input
    """
    return {
        "role": "user",
        "content": f"The following is the scenario for the chat: {problem_statement}",
    }
