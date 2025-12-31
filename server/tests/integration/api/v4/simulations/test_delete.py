"""Route tests for POST /api/v4/simulations/delete endpoint."""

import uuid
from uuid import UUID

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_delete_simulation(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a simulation that is not in use."""
    await get_superadmin_alias(db)

    # Create a simulation without any usage - using inline SQL temporarily
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

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/simulations/delete",
        json={"simulationId": str(simulation_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "deleted successfully" in data["message"].lower()

    # Verify simulation was deleted - using inline SQL temporarily
    simulation = await db.fetchrow("SELECT * FROM simulations WHERE id = $1", simulation_id)
    assert simulation is None

