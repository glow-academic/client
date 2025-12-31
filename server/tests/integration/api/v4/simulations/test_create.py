"""Route tests for POST /api/v4/simulations/create endpoint."""

import uuid
from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_create_simulation(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new simulation with all fields."""
    await get_superadmin_alias(db)

    # Get required IDs - using inline SQL temporarily
    rubric_id = await db.fetchval("SELECT id FROM rubrics LIMIT 1")
    if not rubric_id:
        rubric_id = await db.fetchval(
            "INSERT INTO rubrics(name, description, points, pass_points, active) "
            "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
        )

    scenario_id = await db.fetchval("SELECT id FROM scenarios LIMIT 1")
    if not scenario_id:
        scenario_id = await db.fetchval(
            "INSERT INTO scenarios(name, active) VALUES ('Test Scenario', true) RETURNING id"
        )
        await db.execute(
            "INSERT INTO scenario_tree(parent_id, child_id, active) VALUES ($1, $1, true)",
            scenario_id,
        )

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

    # Verify simulation was created - using inline SQL temporarily
    simulation = await db.fetchrow(
        "SELECT * FROM simulations WHERE id = $1", UUID(data["simulationId"])
    )
    assert simulation is not None
    assert simulation["title"] == "Test Simulation"
    assert simulation["description"] == "Test Description"
    assert simulation["active"] is True
    assert simulation["practice_simulation"] is False
    assert simulation["time_limit"] == 60

    # Verify department link was created - using inline SQL temporarily
    dept_link = await db.fetchrow(
        "SELECT * FROM simulation_departments WHERE simulation_id = $1 AND department_id = $2",
        UUID(data["simulationId"]),
        UUID(dept_id),
    )
    assert dept_link is not None

    # Verify scenario link was created - using inline SQL temporarily
    scenario_link = await db.fetchrow(
        "SELECT * FROM simulation_scenarios WHERE simulation_id = $1 AND scenario_id = $2",
        UUID(data["simulationId"]),
        scenario_id,
    )
    assert scenario_link is not None

