"""Route tests for POST /api/v4/artifacts/simulations/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_simulation_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting simulation detail with all data."""
    await get_superadmin_alias(db)

    # Get a simulation from the list
    # v4 routes get profile_id from router dependency, not request body
    list_response = await client.post(
        "/api/v4/artifacts/simulations/list",
        json={},
    )
    assert list_response.status_code == 200
    list_data = list_response.json()

    if not list_data["simulations"]:
        pytest.skip("No simulations in seed data")

    simulation_id = list_data["simulations"][0]["simulation_id"]

    # Get simulation detail - v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/artifacts/simulations/detail",
        json={"simulationId": simulation_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "name" in data
    assert "description" in data
    assert "scenario_ids" in data
    assert "rubric_id" in data
    assert "can_edit" in data
    assert "can_delete" in data
    assert "can_duplicate" in data
    assert "scenarios" in data
    assert isinstance(data["scenarios"], list)
