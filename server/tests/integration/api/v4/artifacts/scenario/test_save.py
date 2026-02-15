"""Integration tests for artifact scenario save endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
SEED_SCENARIO_ID = "019b3be4-3c3a-7a07-b866-50473cddc11e"
# Seed resource IDs from the test scenario
SEED_NAME_ID = "019b995c-8e80-7928-900e-d366eb410e53"


class TestScenarioSaveCreate:
    """Tests for POST /api/v4/artifacts/scenarios/save (create mode)."""

    async def test_create_scenario_success(self, client: httpx.AsyncClient) -> None:
        """SAVE with no input_scenario_id creates a new scenario."""
        payload = {
            "input_scenario_id": None,
            "name_id": SEED_NAME_ID,
        }

        response = await client.post(
            "/api/v4/artifacts/scenarios/save",
            json=payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["scenario_id"] is not None

    async def test_create_scenario_returns_message(
        self, client: httpx.AsyncClient
    ) -> None:
        """SAVE returns a success message."""
        payload = {
            "input_scenario_id": None,
            "name_id": SEED_NAME_ID,
        }

        response = await client.post(
            "/api/v4/artifacts/scenarios/save",
            json=payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        assert response.json()["message"] is not None


class TestScenarioSaveUpdate:
    """Tests for POST /api/v4/artifacts/scenarios/save (update mode)."""

    async def test_update_scenario_success(self, client: httpx.AsyncClient) -> None:
        """SAVE with input_scenario_id updates existing scenario."""
        payload = {
            "input_scenario_id": SEED_SCENARIO_ID,
            "name_id": SEED_NAME_ID,
        }

        response = await client.post(
            "/api/v4/artifacts/scenarios/save",
            json=payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["scenario_id"] == SEED_SCENARIO_ID


class TestScenarioSaveErrors:
    """Tests for POST /api/v4/artifacts/scenarios/save error cases."""

    async def test_save_no_profile_returns_401(self, client: httpx.AsyncClient) -> None:
        """SAVE without X-Profile-Id returns 401."""
        payload = {
            "input_scenario_id": None,
            "name_id": SEED_NAME_ID,
        }

        response = await client.post(
            "/api/v4/artifacts/scenarios/save",
            json=payload,
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
