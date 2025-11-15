"""Route tests for POST /api/v3/simulations/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import (get_cs_dept_id,  # type: ignore
                                get_superadmin_alias)

pytestmark = pytest.mark.asyncio


async def test_get_simulation_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting simulation detail with all data."""
    profile_id = await get_superadmin_alias(db)

    # Get a simulation from the list
    list_response = await client.post(
        "/api/v3/simulations/list",
        json={"profileId": profile_id},
    )
    assert list_response.status_code == 200
    list_data = list_response.json()

    if not list_data["simulations"]:
        pytest.skip("No simulations in seed data")

    simulation_id = list_data["simulations"][0]["simulation_id"]

    # Get simulation detail
    response = await client.post(
        "/api/v3/simulations/detail",
        json={"simulationId": simulation_id, "profileId": profile_id},
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
    assert "scenario_mapping" in data
    assert "rubric_mapping" in data
    assert "department_mapping" in data


async def test_get_simulation_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test simulation detail raises error for non-existent simulation."""
    profile_id = await get_superadmin_alias(db)

    fake_simulation_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/simulations/detail",
        json={"simulationId": fake_simulation_id, "profileId": profile_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data

