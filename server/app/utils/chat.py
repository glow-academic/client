import json
import logging
from datetime import datetime
from typing import Any, Dict, List

from agents.items import TResponseInputItem
from app.models import (AssistantMessages, AssistantToolCalls, Scenarios,
                        SimulationChats, SimulationMessages)
from openai.types.responses import ResponseFunctionToolCallParam
from sqlmodel import Session, select

logger = logging.getLogger(__name__)


def get_simulation_conversation_history(
    messages: List[SimulationMessages],
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
    items = [msg for msg in messages if not msg.content.startswith("Error:")]

    # sort items by created_at
    items = sorted(items, key=lambda x: x.created_at)

    # Group messages by type to handle consecutive responses
    current_response_messages: List[SimulationMessages] = []
    
    for item in items:
        if isinstance(item, SimulationMessages):
            if item.type == "query" and item.content != "":
                # If we have pending response messages, add the latest one
                if current_response_messages:
                    latest_response = current_response_messages[-1]
                    assistant_message_item: TResponseInputItem = {
                        "role": "assistant",
                        "content": latest_response.content,
                    }
                    conversation_history.append(assistant_message_item)
                    current_response_messages = []
                
                # Add the user message
                user_message_item: TResponseInputItem = {
                    "role": "user",
                    "content": item.content,
                }
                conversation_history.append(user_message_item)
            elif item.type == "response" and item.content != "":
                # Collect response messages to find the latest one
                current_response_messages.append(item)
    
    # Handle any remaining response messages at the end
    if current_response_messages:
        latest_response = current_response_messages[-1]
        current_assistant_message_item: TResponseInputItem = {
            "role": "assistant",
            "content": latest_response.content,
        }
        conversation_history.append(current_assistant_message_item)

    return conversation_history


def get_assistant_conversation_history(
    messages: List[AssistantMessages],
    tool_calls: List[AssistantToolCalls],
) -> list[TResponseInputItem]:
    """
    Get the conversation history for a given list of messages and tool calls,
    organized chronologically by creation time.

    Args:
        messages: List of AssistantMessages objects from the database
        tool_calls: List of AssistantToolCalls objects from the database

    Returns:
        List of message objects formatted for OpenAI API consumption,
        chronologically ordered
    """
    # Create a list of all conversation items with their timestamps
    conversation_items: List[Dict[str, Any]] = []

    # Add messages to the list
    for message in messages:
        if message.role == "user" and message.content:
            user_item: TResponseInputItem = {"role": "user", "content": message.content}
            conversation_items.append(
                {"timestamp": message.created_at, "type": "message", "item": user_item}
            )
        elif message.role == "assistant" and message.content:
            assistant_item: TResponseInputItem = {
                "role": "assistant",
                "content": message.content,
            }
            conversation_items.append(
                {
                    "timestamp": message.created_at,
                    "type": "message",
                    "item": assistant_item,
                }
            )

    # Add tool calls to the list
    for tool_call in tool_calls:
        # Add the tool call itself
        logger.info(f"Tool call arguments: {tool_call.tool_arguments}")
        tool_call_item: ResponseFunctionToolCallParam = {
            "arguments": str(tool_call.tool_arguments)
            if tool_call.tool_arguments
            else json.dumps({}),
            "call_id": "call_" + str(tool_call.id),
            "name": tool_call.tool_name,
            "type": "function_call",
            "id": str(tool_call.id),
            "status": "completed",
        }
        conversation_items.append(
            {
                "timestamp": tool_call.created_at,
                "type": "tool_call",
                "item": tool_call_item,
            }
        )

        # Add the tool call output immediately after the tool call
        logger.info(f"Tool call result: {tool_call.tool_result}")
        tool_call_output_item: TResponseInputItem = {
            "call_id": "call_" + str(tool_call.id),
            "output": str(tool_call.tool_result)
            if tool_call.tool_result
            else json.dumps({}),
            "type": "function_call_output",
            "id": str(tool_call.id),
            "status": "completed",
        }
        conversation_items.append(
            {
                "timestamp": tool_call.created_at,
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


def get_chat_scenario(chat: SimulationChats, session: Session) -> TResponseInputItem:
    """
    Get the scenario for a given chat.
    """

    scenario = session.exec(
        select(Scenarios).where(Scenarios.id == chat.scenario_id)
    ).one_or_none()
    if not scenario:
        raise ValueError(f"Scenario not found for chat {chat.id}")

    return {
        "role": "user",
        "content": f"The following is the scenario for the chat: {scenario.problem_statement}",
    }
