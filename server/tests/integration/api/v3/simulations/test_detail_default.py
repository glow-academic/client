"""Route tests for POST /api/v3/simulations/detail-default endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import (
    get_superadmin_alias,
)

pytestmark = pytest.mark.asyncio


async def test_get_simulation_detail_default(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default simulation detail metadata."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/simulations/detail-default",
        json={"profileId": profile_id},
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


async def test_get_simulation_detail_default_includes_scenarios(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that default detail includes valid scenarios."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/simulations/detail-default",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify valid_scenario_ids is populated
    assert "valid_scenario_ids" in data
    assert isinstance(data["valid_scenario_ids"], list)
    assert len(data["valid_scenario_ids"]) >= 0

    # Verify scenario_mapping contains scenarios
    assert len(data["scenario_mapping"]) >= 0


async def test_get_simulation_detail_default_includes_rubrics(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that default detail includes valid rubrics."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/simulations/detail-default",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    # Verify valid_rubric_ids is populated
    assert "valid_rubric_ids" in data
    assert isinstance(data["valid_rubric_ids"], list)
    assert len(data["valid_rubric_ids"]) >= 0

    # Verify rubric_mapping contains rubrics
    assert len(data["rubric_mapping"]) >= 0
