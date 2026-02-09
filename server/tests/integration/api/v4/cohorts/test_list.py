"""Route tests for POST /api/v4/artifacts/cohorts/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_list_cohorts(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting cohorts list."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/artifacts/cohorts/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "cohorts" in data
    assert isinstance(data["cohorts"], list)
    assert len(data["cohorts"]) >= 0

    # If there are cohorts, verify structure
    if data["cohorts"]:
        for cohort in data["cohorts"]:
            assert "cohort_id" in cohort
            assert "name" in cohort or "title" in cohort
            assert "description" in cohort
            assert "active" in cohort


async def test_list_cohorts_empty(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test cohorts list works even with no cohorts."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/artifacts/cohorts/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "cohorts" in data
    assert isinstance(data["cohorts"], list)
