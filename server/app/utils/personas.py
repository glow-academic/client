# app/utils/personas.py
import uuid

from agents.items import TResponseInputItem
from app.models import Personas
from sqlmodel import Session, select


def get_persona_info(persona_id: uuid.UUID, session: Session) -> TResponseInputItem:
    """
    Get the persona information for a given persona.
    """
    persona = session.exec(
        select(Personas).where(Personas.id == persona_id)
    ).one_or_none()
    if not persona:
        raise ValueError(f"Persona with ID {persona_id} not found")

    return {
        "role": "user",
        "content": f"This is the profile of the student: Name: {persona.name} Description: {persona.description}",
    }
