"""Route tests for POST /api/v3/cohorts/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_cohort_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting cohort detail with all data."""
    profile_id = await get_superadmin_alias(db)

    # Create a cohort first
    cohort_id = await db.fetchval(
        "INSERT INTO cohorts(title, description, active) "
        "VALUES ('Test Cohort', 'Test Description', true) RETURNING id"
    )

    response = await client.post(
        "/api/v3/cohorts/detail",
        json={"cohortId": str(cohort_id), "profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "title" in data
    assert "description" in data
    assert "active" in data
    assert "department_ids" in data
    assert "profile_ids" in data
    assert "simulation_ids" in data
    assert "simulations" in data
    assert "staff" in data
    assert "simulation_mapping" in data
    assert "profile_mapping" in data
    assert "department_mapping" in data
    assert isinstance(data["simulations"], list)
    assert isinstance(data["staff"], list)


async def test_get_cohort_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test cohort detail raises error for non-existent cohort."""
    profile_id = await get_superadmin_alias(db)

    fake_cohort_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/cohorts/detail",
        json={"cohortId": fake_cohort_id, "profileId": profile_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()

