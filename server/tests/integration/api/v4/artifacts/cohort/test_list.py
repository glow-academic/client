"""Integration tests for artifact cohort list endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}


class TestCohortList:
    """Tests for POST /api/v4/artifacts/cohorts/list endpoint."""

    async def test_list_returns_cohorts(self, client: httpx.AsyncClient) -> None:
        """LIST returns cohorts from seed data."""
        response = await client.post(
            "/api/v4/artifacts/cohorts/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["cohorts"] is not None
        assert len(data["cohorts"]) > 0

    async def test_list_returns_actor_name(self, client: httpx.AsyncClient) -> None:
        """LIST returns actor_name from profile context."""
        response = await client.post(
            "/api/v4/artifacts/cohorts/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["actor_name"] is not None

    async def test_list_returns_user_role(self, client: httpx.AsyncClient) -> None:
        """LIST returns user_role from profile context."""
        response = await client.post(
            "/api/v4/artifacts/cohorts/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["user_role"] is not None

    async def test_list_cohorts_have_permissions(
        self, client: httpx.AsyncClient
    ) -> None:
        """LIST cohorts include computed permission fields."""
        response = await client.post(
            "/api/v4/artifacts/cohorts/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        cohorts = data["cohorts"]
        assert len(cohorts) > 0
        first_cohort = cohorts[0]
        assert "can_edit" in first_cohort
        assert "can_delete" in first_cohort
        assert "can_duplicate" in first_cohort

    async def test_list_cohorts_have_core_fields(
        self, client: httpx.AsyncClient
    ) -> None:
        """LIST cohorts include core identifying fields."""
        response = await client.post(
            "/api/v4/artifacts/cohorts/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        cohorts = response.json()["cohorts"]
        assert len(cohorts) > 0
        first_cohort = cohorts[0]
        assert "cohort_id" in first_cohort
        assert "name" in first_cohort

    async def test_list_returns_profiles(self, client: httpx.AsyncClient) -> None:
        """LIST returns profiles mapping data."""
        response = await client.post(
            "/api/v4/artifacts/cohorts/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "profiles" in data

    async def test_list_returns_simulations(self, client: httpx.AsyncClient) -> None:
        """LIST returns simulations mapping data."""
        response = await client.post(
            "/api/v4/artifacts/cohorts/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "simulations" in data

    async def test_list_returns_departments(self, client: httpx.AsyncClient) -> None:
        """LIST returns departments mapping data."""
        response = await client.post(
            "/api/v4/artifacts/cohorts/list",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "departments" in data

    async def test_list_no_profile_returns_401(self, client: httpx.AsyncClient) -> None:
        """LIST without X-Profile-Id returns 401."""
        response = await client.post(
            "/api/v4/artifacts/cohorts/list",
            json={},
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
