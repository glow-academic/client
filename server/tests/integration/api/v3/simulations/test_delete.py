"""Route tests for POST /api/v3/simulations/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import (
    get_superadmin_alias,
)

pytestmark = pytest.mark.asyncio


async def test_delete_simulation(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a simulation that is not in use."""
    await get_superadmin_alias(db)

    # Create a simulation without any usage
    rubric_id = await db.fetchval("SELECT id FROM rubrics LIMIT 1")
    if not rubric_id:
        rubric_id = await db.fetchval(
            "INSERT INTO rubrics(name, description, points, pass_points, active) "
            "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
        )

    simulation_id = await db.fetchval(
        "INSERT INTO simulations(title, description, active, practice_simulation, rubric_id) "
        "VALUES ('Deletable Simulation', 'Test', true, false, $1) RETURNING id",
        rubric_id,
    )

    response = await client.post(
        "/api/v3/simulations/delete",
        json={"simulationId": str(simulation_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "deleted successfully" in data["message"].lower()

    # Verify simulation was deleted
    simulation = await db.fetchrow(
        "SELECT * FROM simulations WHERE id = $1", simulation_id
    )
    assert simulation is None


async def test_delete_simulation_in_use(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that deleting a simulation linked to cohorts fails."""
    await get_superadmin_alias(db)

    # Create a simulation
    rubric_id = await db.fetchval("SELECT id FROM rubrics LIMIT 1")
    if not rubric_id:
        rubric_id = await db.fetchval(
            "INSERT INTO rubrics(name, description, points, pass_points, active) "
            "VALUES ('Test Rubric', 'Test', 100, 70, true) RETURNING id"
        )

    simulation_id = await db.fetchval(
        "INSERT INTO simulations(title, description, active, practice_simulation, rubric_id) "
        "VALUES ('Used Simulation', 'Test', true, false, $1) RETURNING id",
        rubric_id,
    )

    # Create a cohort link (this makes it "in use")
    cohort_id = await db.fetchval(
        "INSERT INTO cohorts(title, description, active) VALUES ('Test Cohort', 'Test', true) RETURNING id"
    )
    await db.execute(
        "INSERT INTO cohort_simulations(cohort_id, simulation_id, active) VALUES ($1, $2, true)",
        cohort_id,
        simulation_id,
    )

    response = await client.post(
        "/api/v3/simulations/delete",
        json={"simulationId": str(simulation_id)},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "in use by" in data["detail"].lower()

    # Verify simulation was not deleted
    simulation = await db.fetchrow(
        "SELECT * FROM simulations WHERE id = $1", simulation_id
    )
    assert simulation is not None


async def test_delete_simulation_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent simulation."""
    await get_superadmin_alias(db)

    fake_simulation_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/simulations/delete",
        json={"simulationId": fake_simulation_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
