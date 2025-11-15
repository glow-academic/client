"""Route tests for POST /api/v3/simulations/duplicate endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id  # type: ignore
from tests.seed_helpers import get_superadmin_alias

pytestmark = pytest.mark.asyncio


async def test_duplicate_simulation_with_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a simulation with department links."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # Get or create a rubric
    rubric_id = await db.fetchval("SELECT id FROM rubrics LIMIT 1")
    if not rubric_id:
        rubric_id = await db.fetchval(
            "INSERT INTO rubrics(name, description, points, pass_points, active) VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
        )

    # Create a simulation with department link
    simulation_id = await db.fetchval(
        "INSERT INTO simulations(title, description, active, rubric_id) VALUES ('Original Simulation', 'Test description', true, $1) RETURNING id",
        rubric_id,
    )

    # Link to department
    await db.execute(
        "INSERT INTO simulation_departments(simulation_id, department_id) VALUES ($1, $2)",
        simulation_id,
        dept_id,
    )

    # Create a scenario and link it to the simulation
    scenario_id = await db.fetchval(
        "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
    )
    await db.execute(
        "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
        scenario_id,
    )
    await db.execute(
        "INSERT INTO simulation_scenarios(simulation_id, scenario_id, active, position) VALUES ($1, $2, true, 1)",
        simulation_id,
        scenario_id,
    )

    response = await client.post(
        "/api/v3/simulations/duplicate",
        json={"simulationId": str(simulation_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "simulationId" in data
    new_simulation_id = data["simulationId"]
    assert new_simulation_id != str(simulation_id)

    # Verify department link was duplicated
    new_dept_link = await db.fetchrow(
        "SELECT * FROM simulation_departments WHERE simulation_id = $1 AND department_id = $2",
        new_simulation_id,
        dept_id,
    )
    assert new_dept_link is not None
    assert new_dept_link["active"] is True

    # Verify scenario relationship was duplicated
    new_scenario_link = await db.fetchrow(
        "SELECT * FROM simulation_scenarios WHERE simulation_id = $1 AND scenario_id = $2",
        new_simulation_id,
        scenario_id,
    )
    assert new_scenario_link is not None


async def test_duplicate_simulation_without_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a simulation without department links (cross-department)."""
    profile_id = await get_superadmin_alias(db)

    # Get or create a rubric
    rubric_id = await db.fetchval("SELECT id FROM rubrics LIMIT 1")
    if not rubric_id:
        rubric_id = await db.fetchval(
            "INSERT INTO rubrics(name, description, points, pass_points, active) VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
        )

    # Create a simulation without department links
    simulation_id = await db.fetchval(
        "INSERT INTO simulations(title, description, active, rubric_id) VALUES ('Cross-Dept Simulation', 'Test', true, $1) RETURNING id",
        rubric_id,
    )

    response = await client.post(
        "/api/v3/simulations/duplicate",
        json={"simulationId": str(simulation_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    new_simulation_id = data["simulationId"]

    # Verify no department links were created (original had none)
    dept_links = await db.fetch(
        "SELECT * FROM simulation_departments WHERE simulation_id = $1",
        new_simulation_id,
    )
    assert len(dept_links) == 0
