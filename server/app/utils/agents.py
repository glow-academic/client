# app/utils/agents.py
import uuid

from agents.items import TResponseInputItem
from app.models import Agents
from sqlmodel import Session, select


def get_agent_info(agent_id: uuid.UUID, session: Session) -> TResponseInputItem:
    """
    Get the agent information for a given agent.
    """
    agent = session.exec(select(Agents).where(Agents.id == agent_id)).one_or_none()
    if not agent:
        raise ValueError(f"Agent with ID {agent_id} not found")

    return {
        "role": "user",
        "content": f"This is the profile of the student: Name: {agent.name} Description: {agent.description}",
    }