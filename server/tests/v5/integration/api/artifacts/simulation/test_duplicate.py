"""Integration tests for artifact simulation duplicate endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
SEED_SIMULATION_ID = "019b3be4-3cb8-7aa7-b0e6-8652f2ad09f7"
ZEROED_UUID = "00000000-0000-0000-0000-000000000000"


class TestSimulationDuplicate:
    """Tests for POST /api/v5/artifacts/simulations/duplicate endpoint."""

    async def test_duplicate_seed_simulation(self, client: httpx.AsyncClient) -> None:
        """DUPLICATE the seed simulation creates a new copy."""
        response = await client.post(
            "/api/v5/artifacts/simulations/duplicate",
            json={"simulation_id": SEED_SIMULATION_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["simulation_id"] is not None
        assert data["simulation_id"] != SEED_SIMULATION_ID

    async def test_duplicate_returns_simulation_name(
        self, client: httpx.AsyncClient
    ) -> None:
        """DUPLICATE returns the simulation_name of the original."""
        response = await client.post(
            "/api/v5/artifacts/simulations/duplicate",
            json={"simulation_id": SEED_SIMULATION_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["simulation_name"] is not None

    async def test_duplicate_nonexistent_returns_error(
        self, client: httpx.AsyncClient
    ) -> None:
        """DUPLICATE with nonexistent simulation_id returns error."""
        response = await client.post(
            "/api/v5/artifacts/simulations/duplicate",
            json={"simulation_id": ZEROED_UUID},
            headers=HEADERS,
        )

        assert response.status_code == 404


class TestSimulationDuplicateErrors:
    """Tests for POST /api/v5/artifacts/simulations/duplicate error cases."""

    async def test_duplicate_no_profile_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        """DUPLICATE without X-Profile-Id returns 401."""
        response = await client.post(
            "/api/v5/artifacts/simulations/duplicate",
            json={"simulation_id": SEED_SIMULATION_ID},
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
