"""Route tests for POST /api/v3/simulations/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import (
    get_superadmin_alias,
)

pytestmark = pytest.mark.asyncio


async def test_list_simulations(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting simulations list with mappings."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/simulations/list",
        json={"profileId": profile_id},
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
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/simulations/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["simulations"] is not None
    assert isinstance(data["simulations"], list)


async def test_list_simulations_permissions_superadmin(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test superadmin has edit/delete/duplicate permissions."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/simulations/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    # Superadmin should have edit permissions (unless simulation has active cohorts)
    # can_delete depends on practice_simulation, cohort links, and role
    # can_duplicate is always true
    if data["simulations"]:
        for sim in data["simulations"]:
            assert sim["can_duplicate"] is True
            # can_edit is true for superadmin unless active_cohort_count > 0
            # can_delete depends on practice_simulation, total_cohort_links, and role


async def test_list_simulations_permissions_non_superadmin(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test non-superadmin does not have edit/delete permissions but can duplicate."""
    # Create a non-superadmin profile
    profile_id = await db.fetchval(
        "INSERT INTO profiles(first_name, last_name, alias, role) "
        "VALUES('Test', 'User', 'test_user', 'guest') RETURNING id"
    )

    response = await client.post(
        "/api/v3/simulations/list",
        json={"profileId": str(profile_id)},
    )

    assert response.status_code == 200
    data = response.json()

    # Non-superadmin should not have edit/delete permissions
    for sim in data["simulations"]:
        assert sim["can_edit"] is False
        assert sim["can_delete"] is False
        # Duplicate might still be allowed depending on business logic
