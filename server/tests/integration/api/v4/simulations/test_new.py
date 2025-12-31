"""Route tests for POST /api/v4/simulations/new endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_simulation_new(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default simulation detail metadata."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency, not request body
    response = await client.post(
        "/api/v4/simulations/new",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify default structure
    assert "name" in data
    assert "description" in data
    assert "department_ids" in data
    assert "valid_department_ids" in data
    assert "scenario_ids" in data
    assert "valid_scenario_ids" in data
    assert "rubric_id" in data
    assert "valid_rubric_ids" in data
    assert "can_edit" in data
    assert "can_delete" in data
    assert "can_duplicate" in data
    assert "scenarios" in data
    assert isinstance(data["scenarios"], list)
    assert "scenario_mapping" in data
    assert isinstance(data["scenario_mapping"], dict)
    assert "rubric_mapping" in data
    assert isinstance(data["rubric_mapping"], dict)
    assert "department_mapping" in data
    assert isinstance(data["department_mapping"], dict)

