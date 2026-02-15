"""Integration tests for artifact simulation save endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
SEED_SIMULATION_ID = "019b3be4-3cb8-7aa7-b0e6-8652f2ad09f7"
# Seed resource IDs from first simulation
SEED_NAME_ID = "019b995c-8e93-7fce-9bc7-b9778a79bb71"
SEED_DESCRIPTION_ID = "019b995c-8e96-7744-a761-ac55cbd07862"


def _build_save_request(
    simulation_id: str | None = None,
    name_id: str | None = SEED_NAME_ID,
    description_id: str | None = SEED_DESCRIPTION_ID,
    group_id: str = "00000000-0000-0000-0000-000000000001",
) -> dict:
    """Build a minimal valid save request."""
    return {
        "input_simulation_id": simulation_id,
        "group_id": group_id,
        "names": {"resource_id": name_id},
        "descriptions": {"resource_id": description_id},
        "flags": {"resource_ids": []},
        "departments": {"resource_ids": []},
        "scenarios": {"resource_ids": []},
        "scenario_flags": {"resource_ids": []},
        "scenario_positions": {"resource_ids": []},
        "scenario_rubrics": {"resource_ids": []},
        "scenario_time_limits": {"resource_ids": []},
        "scenario_personas": {"resource_ids": []},
    }


class TestSimulationSaveCreate:
    """Tests for POST /api/v4/artifacts/simulations/save (create mode)."""

    async def test_create_simulation_success(self, client: httpx.AsyncClient) -> None:
        """SAVE with no input_simulation_id creates a new simulation."""
        payload = _build_save_request(simulation_id=None)

        response = await client.post(
            "/api/v4/artifacts/simulations/save",
            json=payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["simulation_id"] is not None

    async def test_create_simulation_returns_actor_name(
        self, client: httpx.AsyncClient
    ) -> None:
        """SAVE returns actor_name from profile context."""
        payload = _build_save_request(simulation_id=None)

        response = await client.post(
            "/api/v4/artifacts/simulations/save",
            json=payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        assert response.json()["actor_name"] is not None


class TestSimulationSaveUpdate:
    """Tests for POST /api/v4/artifacts/simulations/save (update mode)."""

    async def test_update_simulation_success(self, client: httpx.AsyncClient) -> None:
        """SAVE with input_simulation_id updates existing simulation."""
        payload = _build_save_request(simulation_id=SEED_SIMULATION_ID)

        response = await client.post(
            "/api/v4/artifacts/simulations/save",
            json=payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["simulation_id"] == SEED_SIMULATION_ID


class TestSimulationSaveErrors:
    """Tests for POST /api/v4/artifacts/simulations/save error cases."""

    async def test_save_no_profile_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        """SAVE without X-Profile-Id returns 401."""
        payload = _build_save_request(simulation_id=None)

        response = await client.post(
            "/api/v4/artifacts/simulations/save",
            json=payload,
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
