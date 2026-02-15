"""Integration tests for artifact scenario duplicate endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
SEED_SCENARIO_ID = "019b3be4-3c3a-7a07-b866-50473cddc11e"
ZEROED_UUID = "00000000-0000-0000-0000-000000000000"


class TestScenarioDuplicate:
    """Tests for POST /api/v4/artifacts/scenarios/duplicate endpoint."""

    async def test_duplicate_seed_scenario(self, client: httpx.AsyncClient) -> None:
        """DUPLICATE the seed scenario creates a new copy."""
        response = await client.post(
            "/api/v4/artifacts/scenarios/duplicate",
            json={"scenario_id": SEED_SCENARIO_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["scenario_id"] is not None
        assert data["scenario_id"] != SEED_SCENARIO_ID

    async def test_duplicate_returns_scenario_name(
        self, client: httpx.AsyncClient
    ) -> None:
        """DUPLICATE returns the scenario_name of the new copy."""
        response = await client.post(
            "/api/v4/artifacts/scenarios/duplicate",
            json={"scenario_id": SEED_SCENARIO_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["scenario_name"] is not None

    async def test_duplicate_nonexistent_returns_error(
        self, client: httpx.AsyncClient
    ) -> None:
        """DUPLICATE with nonexistent scenario_id returns error."""
        response = await client.post(
            "/api/v4/artifacts/scenarios/duplicate",
            json={"scenario_id": ZEROED_UUID},
            headers=HEADERS,
        )

        assert response.status_code in (400, 404)


class TestScenarioDuplicateErrors:
    """Tests for POST /api/v4/artifacts/scenarios/duplicate error cases."""

    async def test_duplicate_no_profile_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        """DUPLICATE without X-Profile-Id returns 401."""
        response = await client.post(
            "/api/v4/artifacts/scenarios/duplicate",
            json={"scenario_id": SEED_SCENARIO_ID},
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
