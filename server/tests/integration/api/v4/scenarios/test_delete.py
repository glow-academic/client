"""Route tests for POST /api/v4/scenarios/delete endpoint."""

import uuid
from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import GetScenarioByIdSqlParams, GetScenarioByIdSqlRow
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_delete_scenario(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a scenario."""
    await get_superadmin_alias(db)

    # Create a scenario - using inline SQL temporarily
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Scenario to Delete', true) RETURNING id"
    )

    # Insert self-referencing tree edge
    await db.execute(
        "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
        scenario_id,
    )

    # Create problem statement
    await db.execute(
        "INSERT INTO scenario_problem_statements(scenario_id, problem_statement, active) VALUES ($1, 'Test problem', true)",
        scenario_id,
    )

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

    # Create a scenario - using inline SQL temporarily
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Scenario in Use', true) RETURNING id"
    )

    # Insert self-referencing tree edge
    await db.execute(
        "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
        scenario_id,
    )

    # Create problem statement
    await db.execute(
        "INSERT INTO scenario_problem_statements(scenario_id, problem_statement, active) VALUES ($1, 'Test problem', true)",
        scenario_id,
    )

    # Create a simulation and link it to the scenario - using inline SQL temporarily
    rubric_id = await db.fetchval("SELECT id FROM rubrics LIMIT 1")
    if not rubric_id:
        rubric_id = await db.fetchval(
            "INSERT INTO rubrics(name, description, points, pass_points, active) "
            "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
        )

    simulation_id = await db.fetchval(
        "INSERT INTO simulations(title, description, active, practice_simulation, rubric_id) "
        "VALUES ('Test Simulation', 'Test', true, false, $1) RETURNING id",
        rubric_id,
    )

    # Link scenario to simulation
    await db.execute(
        "INSERT INTO simulation_scenarios(simulation_id, scenario_id, active, position) VALUES ($1, $2, true, 1)",
        simulation_id,
        scenario_id,
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
