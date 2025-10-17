# scenario_overview.py
#
# @AshokSaravanan222 & @siladiea
# 07/07/2025

from typing import Any, Dict

import asyncpg  # type: ignore
from app.services.scenario_service import ScenarioService


async def scenario_overview(conn: asyncpg.Connection, scenario_id: str) -> Dict[str, Any]:
    """Scenario details and associated simulations."""
    service = ScenarioService(conn)
    return await service.get_scenario_overview(scenario_id)
