import random
from typing import List

from agents.items import TResponseInputItem
from app.models import (Agents, EvalChats, EvalMessages, Scenarios,
                        SimulationChats, SimulationMessages)
from sqlmodel import Session, select


def get_conversation_history(
    messages: List[SimulationMessages],
) -> list[TResponseInputItem]:
    """
    Get the conversation history for a given list of messages.

    Args:
        messages: List of Messages objects from the database

    Returns:
        List of message objects formatted for OpenAI API consumption
    """
    conversation_history: list[TResponseInputItem] = []

    for message in messages:
        if message.query:
            user_message_item: TResponseInputItem = {"role": "user", "content": message.query}
            conversation_history.append(user_message_item)
        if message.response:
            assistant_message_item: TResponseInputItem = {"role": "assistant", "content": message.response}
            conversation_history.append(assistant_message_item)

    return conversation_history

def get_eval_conversation_history(
    messages: List[EvalMessages],
) -> list[TResponseInputItem]:
    """
    Get the conversation history for a given list of messages.

    Args:
        messages: List of Messages objects from the database

    Returns:
        List of message objects formatted for OpenAI API consumption
    """
    conversation_history: list[TResponseInputItem] = []

    for message in messages:
        if message.type == "query":
            user_message_item: TResponseInputItem = {"role": "user", "content": message.content}
            conversation_history.append(user_message_item)
        if message.type == "response":
            assistant_message_item: TResponseInputItem = {"role": "assistant", "content": message.content}
            conversation_history.append(assistant_message_item)

    return conversation_history


def get_chat_scenario(chat: SimulationChats | EvalChats, session: Session) -> TResponseInputItem:
    """
    Get the scenario for a given chat.
    """

    scenario = session.exec(
        select(Scenarios).where(Scenarios.id == chat.scenario_id)
    ).one_or_none()
    if not scenario:
        raise ValueError(f"Scenario not found for chat {chat.id}")

    return {
        "role": "assistant",
        "content": f"The following is the scenario for the chat: {scenario.description}",
    }


def generate_natural_opening(agent: Agents) -> str:
    """
    Generate a natural conversation opening based on the scenario and agent type.
    """
    openings = [
        f"Hi, how are you doing today?",
        f"Hey, how's it going?",
        f"Hello, how are you?",
    ]

    return random.choice(openings)

