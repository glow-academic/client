"""Route tests for POST /api/v4/simulations/update endpoint."""

import uuid
from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_update_simulation(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a simulation with all fields."""
    await get_superadmin_alias(db)

    # Create a simulation first - using inline SQL temporarily
    rubric_id = await db.fetchval("SELECT id FROM rubrics LIMIT 1")
    if not rubric_id:
        rubric_id = await db.fetchval(
            "INSERT INTO rubrics(name, description, points, pass_points, active) "
            "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
        )

    simulation_id = await db.fetchval(
        "INSERT INTO simulations(title, description, active, practice_simulation, rubric_id) "
        "VALUES ('Original Simulation', 'Original Description', true, false, $1) RETURNING id",
        rubric_id,
    )

    # Get a department ID
    dept_id = await get_cs_dept_id(db)

    # Get a scenario - using inline SQL temporarily
    scenario_id = await db.fetchval("SELECT id FROM scenarios LIMIT 1")
    if not scenario_id:
        scenario_id = await db.fetchval(
            "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
        )
        await db.execute(
            "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
            scenario_id,
        )

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

    # Verify simulation was updated - using inline SQL temporarily
    simulation = await db.fetchrow(
        "SELECT * FROM simulations WHERE id = $1", simulation_id
    )
    assert simulation is not None
    assert simulation["title"] == "Updated Simulation"
    assert simulation["description"] == "Updated Description"
    assert simulation["active"] is False
    assert simulation["practice_simulation"] is True
    assert simulation["time_limit"] == 90
