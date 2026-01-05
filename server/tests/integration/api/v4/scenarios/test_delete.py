"""Route tests for POST /api/v4/scenarios/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestScenarioV4SqlParams,
    CreateTestScenarioV4SqlRow,
    CreateTestSimulationWithRubricV4SqlParams,
    CreateTestSimulationWithRubricV4SqlRow,
    GetOrCreateRubricV4SqlRow,
    GetScenarioByIdSqlParams,
    GetScenarioByIdSqlRow,
)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_delete_scenario(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a scenario."""
    await get_superadmin_alias(db)

    # Create a scenario using SQL file

    scenario_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_create_test_scenario_v4_complete.sql",
        params=CreateTestScenarioV4SqlParams(
            scenario_name="Scenario to Delete",
            scenario_problem_statement="Test problem",
        ),
    )
    typed_scenario = CreateTestScenarioV4SqlRow.model_validate(
        scenario_result.model_dump()
    )
    assert typed_scenario.scenario_id is not None
    scenario_id = typed_scenario.scenario_id

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/scenarios/delete",
        json={"scenarioId": str(scenario_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "deleted successfully" in data["message"].lower()

    # Verify scenario was deleted using SQL file
    scenario_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_get_scenario_by_id_v4_complete.sql",
        params=GetScenarioByIdSqlParams(scenario_id=scenario_id),
    )
    typed_scenario = GetScenarioByIdSqlRow.model_validate(scenario_result.model_dump())
    assert typed_scenario.scenario_id is None


async def test_delete_scenario_in_use(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a scenario that is in use by a simulation."""
    await get_superadmin_alias(db)

    # Create a scenario using SQL file

    scenario_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_create_test_scenario_v4_complete.sql",
        params=CreateTestScenarioV4SqlParams(
            scenario_name="Scenario in Use",
            scenario_problem_statement="Test problem",
        ),
    )
    typed_scenario = CreateTestScenarioV4SqlRow.model_validate(
        scenario_result.model_dump()
    )
    assert typed_scenario.scenario_id is not None
    scenario_id = typed_scenario.scenario_id

    # Get or create rubric using SQL file

    rubric_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/simulations/test_get_or_create_rubric_v4_complete.sql",
        params=None,
    )
    typed_rubric = GetOrCreateRubricV4SqlRow.model_validate(rubric_result.model_dump())
    assert typed_rubric.rubric_id is not None
    rubric_id = typed_rubric.rubric_id

    # Create a simulation and link it to the scenario using SQL files
    simulation_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/simulations/test_create_test_simulation_with_rubric_v4_complete.sql",
        params=CreateTestSimulationWithRubricV4SqlParams(
            rubric_id=rubric_id,
            title="Test Simulation",
            description="Test",
            active=True,
            practice_simulation=False,
        ),
    )
    typed_simulation = CreateTestSimulationWithRubricV4SqlRow.model_validate(
        simulation_result.model_dump()
    )
    assert typed_simulation.simulation_id is not None
    simulation_id = typed_simulation.simulation_id

    # Link scenario to simulation using SQL file
    from tests.sql.types import CreateSimulationScenarioLinkV4SqlParams

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/scenarios/test_create_simulation_scenario_link_v4_complete.sql",
        params=CreateSimulationScenarioLinkV4SqlParams(
            input_simulation_id=simulation_id,
            input_scenario_id=scenario_id,
            input_position=1,
        ),
    )

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/scenarios/delete",
        json={"scenarioId": str(scenario_id)},
    )

    assert response.status_code == 400
    data = response.json()
    assert "in use" in data["detail"].lower()


async def test_delete_scenario_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent scenario."""
    await get_superadmin_alias(db)

    fake_scenario_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/scenarios/delete",
        json={"scenarioId": fake_scenario_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "not found" in data["detail"].lower()
