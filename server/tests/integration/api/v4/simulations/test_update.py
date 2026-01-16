"""Route tests for POST /api/v4/simulations/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestSimulationWithRubricV4SqlParams,
    CreateTestSimulationWithRubricV4SqlRow,
    GetOrCreateRubricV4SqlRow,
    GetOrCreateScenarioV4SqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_update_simulation(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a simulation with all fields."""
    await get_superadmin_alias(db)

    # Get or create rubric using SQL file
    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/simulations/test_get_or_create_rubric_v4_complete.sql",
        params=None,
    )
    typed_rubric = GetOrCreateRubricV4SqlRow.model_validate(rubric_result.model_dump())
    assert typed_rubric.rubric_id is not None
    rubric_id = typed_rubric.rubric_id

    # Create a simulation first using SQL file
    simulation_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/simulations/test_create_test_simulation_with_rubric_v4_complete.sql",
        params=CreateTestSimulationWithRubricV4SqlParams(
            rubric_id=rubric_id,
            title="Original Simulation",
            description="Original Description",
            active=True,
            practice_simulation=False,
        ),
    )
    typed_simulation = CreateTestSimulationWithRubricV4SqlRow.model_validate(
        simulation_result.model_dump()
    )
    assert typed_simulation.simulation_id is not None
    simulation_id = typed_simulation.simulation_id

    # Get a department ID
    dept_id = await get_cs_dept_id(db)

    # Get or create scenario using SQL file
    scenario_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/simulations/test_get_or_create_scenario_v4_complete.sql",
        params=None,
    )
    typed_scenario = GetOrCreateScenarioV4SqlRow.model_validate(
        scenario_result.model_dump()
    )
    assert typed_scenario.scenario_id is not None
    scenario_id = typed_scenario.scenario_id

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/simulations/update",
        json={
            "simulationId": str(simulation_id),
            "title": "Updated Simulation",
            "description": "Updated Description",
            "department_ids": [str(dept_id)],
            "active": False,
            "practice_simulation": True,
            "time_limit": 90,
            "rubric_id": str(rubric_id),
            "scenario_ids": [str(scenario_id)],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Simulation 'Updated Simulation' updated successfully"

    # Verify simulation was updated using SQL file
    from tests.sql.types import (
        GetSimulationByIdWithTimeLimitV4SqlParams,
        GetSimulationByIdWithTimeLimitV4SqlRow,
    )

    updated_simulation_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/simulations/test_get_simulation_by_id_with_time_limit_v4_complete.sql",
        params=GetSimulationByIdWithTimeLimitV4SqlParams(
            input_simulation_id=simulation_id
        ),
    )
    typed_updated_simulation = GetSimulationByIdWithTimeLimitV4SqlRow.model_validate(
        updated_simulation_result.model_dump()
    )
    assert typed_updated_simulation.simulation_id is not None
    assert typed_updated_simulation.title == "Updated Simulation"
    assert typed_updated_simulation.description == "Updated Description"
    assert typed_updated_simulation.active is False
    assert typed_updated_simulation.practice_simulation is True
    assert typed_updated_simulation.time_limit == 90
