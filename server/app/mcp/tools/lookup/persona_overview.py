# persona_overview.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

from typing import Any, Dict

import asyncpg  # type: ignore
from app.services.persona_service import PersonaService


async def persona_overview(conn: asyncpg.Connection, persona_id: str) -> Dict[str, Any]:
    """Persona details and associated scenarios."""
    service = PersonaService(conn)
    return await service.get_persona_overview(persona_id)
