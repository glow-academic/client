# simulation_attempts.py
# Refactored: SQL logic moved to simulation_service.py

from typing import Any, Dict, List

import asyncpg  # type: ignore
from app.services.simulation_service import SimulationService


async def simulation_attempts(conn: asyncpg.Connection, sim_id: str, limit: int = 200) -> List[Dict[str, Any]]:
    """
    Flat list of attempts (who, when, score)
    List all attempts for a specific simulation.

    Input
      • conn - Database connection from asyncpg
      • sim_id - UUID of the simulation
      • limit - Max results (default: 200)

    Returns
      [ { "id": "…", "student": "…", "score": 85, … }, … ]

    Quick-start
      ask:  "List last 200 attempts on Sim Y"
      call: simulation_attempts(conn, "uuid-here")

    See also simulation_overview() for aggregate stats.
    """
    service = SimulationService(conn)
    return await service.get_simulation_attempts(sim_id, limit)
