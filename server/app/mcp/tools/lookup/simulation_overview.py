# simulation_overview.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

from typing import Any, Dict

import asyncpg  # type: ignore
from app.services.simulation_service import SimulationService


async def simulation_overview(conn: asyncpg.Connection, sim_id: str) -> Dict[str, Any]:
    """Simulation meta, rubric, cohorts, scenarios, and pass stats."""
    service = SimulationService(conn)
    return await service.get_simulation_overview(sim_id)
