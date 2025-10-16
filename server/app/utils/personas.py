# app/utils/personas.py
import uuid

import asyncpg  # type: ignore
from agents.items import TResponseInputItem


async def get_persona_info(conn: asyncpg.Connection, persona_id: uuid.UUID) -> TResponseInputItem:
    """
    Get the persona information for a given persona.
    """
    persona = await conn.fetchrow(
        "SELECT name, description FROM personas WHERE id = $1",
        persona_id
    )
    if not persona:
        raise ValueError(f"Persona with ID {persona_id} not found")

    return {
        "role": "user",
        "content": f"This is the profile of the student: Name: {persona['name']} Description: {persona.get('description', '')}",
    }
