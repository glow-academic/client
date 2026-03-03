"""Integration tests for artifact scenario delete endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
SEED_SCENARIO_ID = "019b3be4-3c3a-7a07-b866-50473cddc11e"
# Seed resource IDs for creating a scenario to delete
SEED_NAME_ID = "019b995c-8e80-7928-900e-d366eb410e53"
ZEROED_UUID = "00000000-0000-0000-0000-000000000000"


class TestScenarioDelete:
    """Tests for POST /api/v5/artifacts/scenarios/delete endpoint."""

    async def test_delete_created_scenario(self, client: httpx.AsyncClient) -> None:
        """DELETE a freshly created scenario succeeds."""
        # Arrange — create a scenario to delete
        save_payload = {
            "input_scenario_id": None,
            "name_id": SEED_NAME_ID,
        }
        save_response = await client.post(
            "/api/v5/artifacts/scenarios/save",
            json=save_payload,
            headers=HEADERS,
        )
        assert save_response.status_code == 200
        new_scenario_id = save_response.json()["scenario_id"]

        # Act
        response = await client.post(
            "/api/v5/artifacts/scenarios/delete",
            json={"scenario_id": new_scenario_id},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] is True

    async def test_delete_nonexistent_returns_error(
        self, client: httpx.AsyncClient
    ) -> None:
        """DELETE with nonexistent scenario_id returns error."""
        response = await client.post(
            "/api/v5/artifacts/scenarios/delete",
            json={"scenario_id": ZEROED_UUID},
            headers=HEADERS,
        )

        assert response.status_code in (400, 404)


class TestScenarioDeleteErrors:
    """Tests for POST /api/v5/artifacts/scenarios/delete error cases."""

    async def test_delete_no_profile_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        """DELETE without X-Profile-Id returns 401."""
        response = await client.post(
            "/api/v5/artifacts/scenarios/delete",
            json={"scenario_id": SEED_SCENARIO_ID},
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
