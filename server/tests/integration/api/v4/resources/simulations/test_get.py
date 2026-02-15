"""Integration tests for resource simulations get endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
# This is a simulations_resource ID (not simulation_artifact)
SEED_SIMULATION_ID = "019bb25e-e62c-789f-add0-0e4d307e952c"


class TestResourceSimulationsGet:
    """Tests for POST /api/v4/resources/simulations/get endpoint."""

    async def test_get_returns_simulations_by_ids(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET with valid IDs returns simulation items."""
        response = await client.post(
            "/api/v4/resources/simulations/get",
            json={"ids": [SEED_SIMULATION_ID]},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["items"] is not None
        assert len(data["items"]) > 0

    async def test_get_returns_empty_for_no_ids(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET with empty IDs returns empty list."""
        response = await client.post(
            "/api/v4/resources/simulations/get",
            json={"ids": []},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["items"] is not None
        assert len(data["items"]) == 0

    async def test_get_no_profile_returns_401(self, client: httpx.AsyncClient) -> None:
        """GET without X-Profile-Id returns 401."""
        response = await client.post(
            "/api/v4/resources/simulations/get",
            json={"ids": [SEED_SIMULATION_ID]},
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
