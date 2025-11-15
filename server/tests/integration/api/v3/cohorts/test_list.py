"""Route tests for POST /api/v3/cohorts/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_list_cohorts(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting cohorts list with mappings."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/cohorts/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "cohorts" in data
    assert "profile_mapping" in data
    assert "simulation_mapping" in data
    assert "department_mapping" in data
    assert isinstance(data["cohorts"], list)
    assert len(data["cohorts"]) >= 0

    # If there are cohorts, verify structure
    if data["cohorts"]:
        for cohort in data["cohorts"]:
            assert "cohort_id" in cohort
            assert "name" in cohort
            assert "description" in cohort
            assert "active" in cohort
            assert "profile_ids" in cohort
            assert "simulation_ids" in cohort
            assert "can_edit" in cohort
            assert "can_delete" in cohort
            assert "can_duplicate" in cohort
            assert "can_leave" in cohort


async def test_list_cohorts_empty(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test cohorts list works even with no cohorts."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/cohorts/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "cohorts" in data
    assert isinstance(data["cohorts"], list)
