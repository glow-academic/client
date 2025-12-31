"""Route tests for POST /api/v4/simulations/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_list_simulations(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting simulations list with mappings."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/simulations/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert "simulations" in data
    assert "scenario_mapping" in data
    assert "rubric_mapping" in data
    assert "department_mapping" in data
    assert isinstance(data["simulations"], list)
    assert isinstance(data["scenario_mapping"], dict)
    assert isinstance(data["rubric_mapping"], dict)
    assert isinstance(data["department_mapping"], dict)

    # If simulations exist, verify structure
    if data["simulations"]:
        sim = data["simulations"][0]
        assert "simulation_id" in sim
        assert "name" in sim
        assert "description" in sim
        assert "scenario_ids" in sim
        assert "rubric_id" in sim
        assert "can_edit" in sim
        assert "can_delete" in sim
        assert "can_duplicate" in sim
        assert isinstance(sim["scenario_ids"], list)


async def test_list_simulations_empty(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test simulations list works even with no simulations."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/simulations/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert "simulations" in data
    assert isinstance(data["simulations"], list)

