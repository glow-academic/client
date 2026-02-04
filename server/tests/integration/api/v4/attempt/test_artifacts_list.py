"""Route tests for POST /api/v4/artifacts/attempt/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_attempt_list_artifact_bundle(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test attempt list artifact response shape."""
    await get_superadmin_alias(db)

    response = await client.post(
        "/api/v4/artifacts/attempt/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert "data" in data
    assert "total_count" in data
    assert "page" in data
    assert "page_size" in data
    assert "total_pages" in data
    assert "simulation_options" in data
    assert "scenario_options" in data
    assert "profile_options" in data
