"""Route tests for POST /api/v4/scenarios/new endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_scenario_new(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting new scenario form data."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/scenarios/new",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    # Should return default structure for creating a new scenario
    # Exact fields depend on the API response structure

