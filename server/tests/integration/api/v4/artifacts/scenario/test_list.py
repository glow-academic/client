"""Integration tests for artifact scenario list endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}


class TestScenarioList:
    """Tests for POST /api/v4/artifacts/scenarios/list endpoint."""

    async def test_list_returns_scenarios(self, client: httpx.AsyncClient) -> None:
        """LIST returns scenarios from seed data."""
        response = await client.post(
            "/api/v4/artifacts/scenarios/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["scenarios"] is not None
        assert len(data["scenarios"]) > 0

    async def test_list_returns_actor_name(self, client: httpx.AsyncClient) -> None:
        """LIST returns actor_name from profile context."""
        response = await client.post(
            "/api/v4/artifacts/scenarios/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["actor_name"] is not None

    async def test_list_scenarios_have_permissions(
        self, client: httpx.AsyncClient
    ) -> None:
        """LIST scenarios include computed permission fields."""
        response = await client.post(
            "/api/v4/artifacts/scenarios/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        scenarios = data["scenarios"]
        assert len(scenarios) > 0
        first_scenario = scenarios[0]
        assert "can_edit" in first_scenario
        assert "can_delete" in first_scenario
        assert "can_duplicate" in first_scenario

    async def test_list_scenarios_have_core_fields(
        self, client: httpx.AsyncClient
    ) -> None:
        """LIST scenarios include core identifying fields."""
        response = await client.post(
            "/api/v4/artifacts/scenarios/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        scenarios = response.json()["scenarios"]
        assert len(scenarios) > 0
        first_scenario = scenarios[0]
        assert "scenario_id" in first_scenario
        assert "title" in first_scenario

    async def test_list_returns_objectives(self, client: httpx.AsyncClient) -> None:
        """LIST returns objectives filter data."""
        response = await client.post(
            "/api/v4/artifacts/scenarios/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "objectives" in data

    async def test_list_returns_personas(self, client: httpx.AsyncClient) -> None:
        """LIST returns personas filter data."""
        response = await client.post(
            "/api/v4/artifacts/scenarios/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "personas" in data

    async def test_list_returns_departments(self, client: httpx.AsyncClient) -> None:
        """LIST returns departments filter data."""
        response = await client.post(
            "/api/v4/artifacts/scenarios/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "departments" in data

    async def test_list_returns_simulations(self, client: httpx.AsyncClient) -> None:
        """LIST returns simulations filter data."""
        response = await client.post(
            "/api/v4/artifacts/scenarios/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "simulations" in data

    async def test_list_returns_total_count(self, client: httpx.AsyncClient) -> None:
        """LIST returns total_count for pagination."""
        response = await client.post(
            "/api/v4/artifacts/scenarios/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_count" in data
        assert data["total_count"] > 0

    async def test_list_no_profile_returns_401(self, client: httpx.AsyncClient) -> None:
        """LIST without X-Profile-Id returns 401."""
        response = await client.post(
            "/api/v4/artifacts/scenarios/list",
            json={},
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
