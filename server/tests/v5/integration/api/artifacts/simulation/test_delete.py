"""Integration tests for artifact simulation delete endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
SEED_SIMULATION_ID = "019b3be4-3cb8-7aa7-b0e6-8652f2ad09f7"
# Seed resource IDs for creating a simulation to delete
SEED_NAME_ID = "019b995c-8e93-7fce-9bc7-b9778a79bb71"
SEED_DESCRIPTION_ID = "019b995c-8e96-7744-a761-ac55cbd07862"
ZEROED_UUID = "00000000-0000-0000-0000-000000000000"


class TestSimulationDelete:
    """Tests for POST /api/v5/artifacts/simulations/delete endpoint."""

    async def test_delete_created_simulation(self, client: httpx.AsyncClient) -> None:
        """DELETE a freshly created simulation succeeds."""
        # Arrange — create a simulation to delete
        save_payload = {
            "input_simulation_id": None,
            "group_id": "00000000-0000-0000-0000-000000000001",
            "names": {"resource_id": SEED_NAME_ID},
            "descriptions": {"resource_id": SEED_DESCRIPTION_ID},
            "flags": {"resource_ids": []},
            "departments": {"resource_ids": []},
            "scenarios": {"resource_ids": []},
            "scenario_flags": {"resource_ids": []},
            "scenario_positions": {"resource_ids": []},
            "scenario_rubrics": {"resource_ids": []},
            "scenario_time_limits": {"resource_ids": []},
            "scenario_personas": {"resource_ids": []},
        }
        save_response = await client.post(
            "/api/v5/artifacts/simulations/save",
            json=save_payload,
            headers=HEADERS,
        )
        assert save_response.status_code == 200
        new_simulation_id = save_response.json()["simulation_id"]

        # Act
        response = await client.post(
            "/api/v5/artifacts/simulations/delete",
            json={"simulation_id": new_simulation_id},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] is True

    async def test_delete_nonexistent_returns_error(
        self, client: httpx.AsyncClient
    ) -> None:
        """DELETE with nonexistent simulation_id returns error."""
        response = await client.post(
            "/api/v5/artifacts/simulations/delete",
            json={"simulation_id": ZEROED_UUID},
            headers=HEADERS,
        )

        assert response.status_code == 404


class TestSimulationDeleteErrors:
    """Tests for POST /api/v5/artifacts/simulations/delete error cases."""

    async def test_delete_no_profile_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        """DELETE without X-Profile-Id returns 401."""
        response = await client.post(
            "/api/v5/artifacts/simulations/delete",
            json={"simulation_id": SEED_SIMULATION_ID},
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
