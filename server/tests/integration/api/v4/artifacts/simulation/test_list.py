"""Integration tests for artifact simulation list endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}


class TestSimulationList:
    """Tests for POST /api/v4/artifacts/simulations/list endpoint."""

    async def test_list_returns_simulations(self, client: httpx.AsyncClient) -> None:
        """LIST returns simulations from seed data."""
        response = await client.post(
            "/api/v4/artifacts/simulations/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["simulations"] is not None
        assert len(data["simulations"]) > 0

    async def test_list_returns_actor_name(self, client: httpx.AsyncClient) -> None:
        """LIST returns actor_name from profile context."""
        response = await client.post(
            "/api/v4/artifacts/simulations/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["actor_name"] is not None

    async def test_list_simulations_have_permissions(
        self, client: httpx.AsyncClient
    ) -> None:
        """LIST simulations include computed permission fields."""
        response = await client.post(
            "/api/v4/artifacts/simulations/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        simulations = data["simulations"]
        assert len(simulations) > 0
        first_simulation = simulations[0]
        assert "can_edit" in first_simulation
        assert "can_delete" in first_simulation
        assert "can_duplicate" in first_simulation

    async def test_list_simulations_have_core_fields(
        self, client: httpx.AsyncClient
    ) -> None:
        """LIST simulations include core identifying fields."""
        response = await client.post(
            "/api/v4/artifacts/simulations/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        simulations = response.json()["simulations"]
        assert len(simulations) > 0
        first_simulation = simulations[0]
        assert "simulation_id" in first_simulation
        assert "name" in first_simulation

    async def test_list_returns_scenario_options(
        self, client: httpx.AsyncClient
    ) -> None:
        """LIST returns scenario_options filter data."""
        response = await client.post(
            "/api/v4/artifacts/simulations/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "scenario_options" in data

    async def test_list_returns_department_options(
        self, client: httpx.AsyncClient
    ) -> None:
        """LIST returns department_options filter data."""
        response = await client.post(
            "/api/v4/artifacts/simulations/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "department_options" in data

    async def test_list_returns_total_count(self, client: httpx.AsyncClient) -> None:
        """LIST returns total_count for pagination."""
        response = await client.post(
            "/api/v4/artifacts/simulations/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_count" in data
        assert data["total_count"] > 0

    async def test_list_returns_scenarios(self, client: httpx.AsyncClient) -> None:
        """LIST returns scenarios mapping for persona color dots."""
        response = await client.post(
            "/api/v4/artifacts/simulations/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "scenarios" in data

    async def test_list_no_profile_returns_401(self, client: httpx.AsyncClient) -> None:
        """LIST without X-Profile-Id returns 401."""
        response = await client.post(
            "/api/v4/artifacts/simulations/list",
            json={},
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
