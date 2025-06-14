import random
from typing import List

from agents.items import TResponseInputItem
from sqlmodel import Session, select

from server.app.models import (Agents, EvalChats, EvalMessages, Scenarios,
                               SimulationChats, SimulationMessages)


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


def get_chat_scenario(chat: SimulationChats | EvalChats, session: Session) -> dict[str, str]:
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
    if agent.agent_type == "student":
        # Student agents start with a problem or question related to the scenario
        openings = [
            f"I'm having trouble. Can you help me understand it?",
            f"I'm stuck on this problem. Where should I start?",
            f"Can you explain to me? I'm really confused.",
            f"I've been working on this but I'm not getting the right answer.",
            f"I need help with this. I don't know what I'm doing wrong.",
        ]
    else:
        # TA agents start by offering help or asking what the student needs
        openings = [
            f"I see you're working on this. What specific part are you struggling with?",
            f"How can I help you with this today?",
            f"What questions do you have about this?",
            f"Let's work through this together. What have you tried so far?",
            f"I'm here to help with this. What's your main concern?",
        ]

    return random.choice(openings)

