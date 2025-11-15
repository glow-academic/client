"""Route tests for POST /api/v3/simulations/create endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import (
    get_cs_dept_id,  # type: ignore
    get_superadmin_alias,
)

pytestmark = pytest.mark.asyncio


async def test_create_simulation(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new simulation with all fields."""
    await get_superadmin_alias(db)

    # Get required IDs
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

    response = await client.post(
        "/api/v3/simulations/create",
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

    # Verify simulation was created in database
    simulation = await db.fetchrow(
        "SELECT * FROM simulations WHERE id = $1", data["simulationId"]
    )
    assert simulation is not None
    assert simulation["title"] == "Test Simulation"
    assert simulation["description"] == "Test Description"
    assert simulation["active"] is True
    assert simulation["practice_simulation"] is False

    # Verify department link was created
    dept_link = await db.fetchrow(
        "SELECT * FROM simulation_departments WHERE simulation_id = $1 AND department_id = $2",
        data["simulationId"],
        dept_id,
    )
    assert dept_link is not None

    # Verify scenario link was created
    scenario_link = await db.fetchrow(
        "SELECT * FROM simulation_scenarios WHERE simulation_id = $1 AND scenario_id = $2",
        data["simulationId"],
        scenario_id,
    )
    assert scenario_link is not None


async def test_create_simulation_without_departments(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a simulation without department links (cross-department)."""
    await get_superadmin_alias(db)

    rubric_id = await db.fetchval("SELECT id FROM rubrics LIMIT 1")
    if not rubric_id:
        rubric_id = await db.fetchval(
            "INSERT INTO rubrics(name, description, points, pass_points, active) "
            "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
        )

    response = await client.post(
        "/api/v3/simulations/create",
        json={
            "title": "Cross-Dept Simulation",
            "description": "Available to all departments",
            "department_ids": None,
            "active": True,
            "practice_simulation": False,
            "time_limit": None,
            "rubric_id": str(rubric_id),
            "scenario_ids": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True

    # Verify no department links were created
    dept_links = await db.fetch(
        "SELECT * FROM simulation_departments WHERE simulation_id = $1",
        data["simulationId"],
    )
    assert len(dept_links) == 0
