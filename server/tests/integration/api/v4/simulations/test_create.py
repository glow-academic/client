"""Route tests for POST /api/v4/simulations/create endpoint."""

from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore
from tests.sql.types import (
    GetOrCreateRubricV4SqlRow,
    GetOrCreateScenarioV4SqlRow,
)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_create_simulation(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new simulation with all fields."""
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

    dept_id = await get_cs_dept_id(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/simulations/create",
        json={
            "title": "Test Simulation",
            "description": "Test Description",
            "department_ids": [str(dept_id)],
            "active": True,
            "practice_simulation": False,
            "time_limit": 60,
            "rubric_id": str(rubric_id),
            "scenario_ids": [str(scenario_id)],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "simulationId" in data
    assert data["message"] == "Simulation 'Test Simulation' created successfully"

    # Verify simulation was created using SQL file
    from tests.sql.types import (
        GetSimulationByIdWithTimeLimitV4SqlParams,
        GetSimulationByIdWithTimeLimitV4SqlRow,
    )

    simulation_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/simulations/test_get_simulation_by_id_with_time_limit_v4_complete.sql",
        params=GetSimulationByIdWithTimeLimitV4SqlParams(
            input_simulation_id=UUID(data["simulationId"])
        ),
    )
    typed_simulation = GetSimulationByIdWithTimeLimitV4SqlRow.model_validate(
        simulation_result.model_dump()
    )
    assert typed_simulation.simulation_id is not None
    assert typed_simulation.title == "Test Simulation"
    assert typed_simulation.description == "Test Description"
    assert typed_simulation.active is True
    assert typed_simulation.practice_simulation is False
    assert typed_simulation.time_limit == 60

    # Verify department link was created using SQL file
    from tests.sql.types import (
        GetSimulationDepartmentLinkV4SqlParams,
        GetSimulationDepartmentLinkV4SqlRow,
    )

    dept_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/simulations/test_get_simulation_department_link_v4_complete.sql",
        params=GetSimulationDepartmentLinkV4SqlParams(
            input_simulation_id=UUID(data["simulationId"]),
            input_department_id=UUID(dept_id),
        ),
    )
    typed_dept_link = GetSimulationDepartmentLinkV4SqlRow.model_validate(
        dept_link_result.model_dump()
    )
    assert typed_dept_link.simulation_id is not None

    # Verify scenario link was created using SQL file
    from tests.sql.types import (
        GetSimulationScenarioLinkV4SqlParams,
        GetSimulationScenarioLinkV4SqlRow,
    )

    scenario_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/simulations/test_get_simulation_scenario_link_v4_complete.sql",
        params=GetSimulationScenarioLinkV4SqlParams(
            input_simulation_id=UUID(data["simulationId"]),
            input_scenario_id=scenario_id,
        ),
    )
    typed_scenario_link = GetSimulationScenarioLinkV4SqlRow.model_validate(
        scenario_link_result.model_dump()
    )
    assert typed_scenario_link.simulation_id is not None
