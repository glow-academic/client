from typing import List
from app.models import Messages, Chats, Scenarios
from agents.items import TResponseInputItem
from sqlmodel import Session, select


def get_conversation_history(messages: List[Messages]) -> list[TResponseInputItem]:
    """
    Get the conversation history for a given list of messages.

    Args:
        messages: List of Messages objects from the database

    Returns:
        List of message objects formatted for OpenAI API consumption
    """
    conversation_history = []

    for message in messages:
        if message.query:
            user_message_item = {"role": "user", "content": message.query}
            conversation_history.append(user_message_item)
        if message.response:
            assistant_message_item = {"role": "assistant", "content": message.response}
            conversation_history.append(assistant_message_item)

    return conversation_history


def get_chat_scenario(chat: Chats, session: Session) -> str:
    """
    Get the scenario for a given chat.
    """

    scenario = session.exec(select(Scenarios).where(Scenarios.id == chat.scenario_id)).one_or_none()
    if not scenario:
        raise ValueError(f"Scenario not found for chat {chat.id}")

    return {
        "role": "assistant",
        "content": f"The following is the scenario for the chat: {scenario.description}",
    }
