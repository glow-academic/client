# persona_response_times.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025
# Refactored: SQL logic moved to persona_service.py

from typing import Any, Dict

import asyncpg  # type: ignore
from app.services.persona_service import PersonaService


async def persona_response_times(conn: asyncpg.Connection, persona_id: str, window_days: int = 30) -> Dict[str, Any]:
    """
    Persona response time analysis
    Analyze response times for a specific persona.

    Input
      • conn - Database connection from asyncpg
      • persona_id - UUID of the persona
      • window_days - Analysis window in days (default: 30)

    Returns
      { "persona": {…}, "stats": {…}, "recent_responses": […] }

    Quick-start
      ask:  "How fast does persona X respond?"
      call: persona_response_times(conn, "uuid-here")

    See also persona_overview() for persona details.
    """
    service = PersonaService(conn)
    return await service.get_persona_response_times(persona_id, window_days)
