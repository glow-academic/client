"""Internal helper to fetch active scenario counts per simulation."""

from typing import cast
from uuid import UUID

import asyncpg

from app.api.v4.views.analytics.simulation_scenario_counts.types import (
    GetSimulationScenarioCountsResponse,
    SimulationScenarioCountItem,
)
from app.sql.types import (
    GetSimulationScenarioCountsSqlParams,
    GetSimulationScenarioCountsSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/views/analytics/simulation_scenario_counts/get_simulation_scenario_counts_complete.sql"


async def get_simulation_scenario_counts_internal(
    conn: asyncpg.Connection,
    simulation_ids: list[UUID],
) -> GetSimulationScenarioCountsResponse:
    if not simulation_ids:
        return GetSimulationScenarioCountsResponse(items=[])

    result = cast(
        GetSimulationScenarioCountsSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH,
            params=GetSimulationScenarioCountsSqlParams(simulation_ids=simulation_ids),
        ),
    )
    items: list[SimulationScenarioCountItem] = []
    if result and result.items:
        for row in result.items:
            items.append(
                SimulationScenarioCountItem(
                    simulation_id=row.simulation_id,
                    scenario_count=row.scenario_count or 0,
                )
            )
    return GetSimulationScenarioCountsResponse(items=items)
