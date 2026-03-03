"""Integration tests for artifact simulation get endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
SEED_SIMULATION_ID = "019b3be4-3cb8-7aa7-b0e6-8652f2ad09f7"
ZEROED_UUID = "00000000-0000-0000-0000-000000000000"


class TestSimulationGetNew:
    """Tests for POST /api/v5/artifacts/simulations/get with no simulation_id (new mode)."""

    async def test_get_new_returns_defaults(self, client: httpx.AsyncClient) -> None:
        """GET with no simulation_id returns default sections for new simulation."""
        response = await client.post(
            "/api/v5/artifacts/simulations/get",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text[:500]}"
        )
        data = response.json()
        assert data["simulation_exists"] is None or data["simulation_exists"] is False
        assert data["can_edit"] is not None

    async def test_get_new_returns_all_sections(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET new simulation returns all resource sections."""
        response = await client.post(
            "/api/v5/artifacts/simulations/get",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        expected_sections = [
            "names",
            "descriptions",
            "flags",
            "departments",
            "scenarios",
            "scenario_flags",
            "scenario_personas",
            "scenario_positions",
            "scenario_rubrics",
            "scenario_time_limits",
        ]
        for section in expected_sections:
            assert section in data, f"Missing section: {section}"

    async def test_get_new_sections_have_metadata(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET new simulation sections include show/required/show_ai_generate metadata."""
        response = await client.post(
            "/api/v5/artifacts/simulations/get",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        names_section = data["names"]
        assert "show" in names_section
        assert "required" in names_section
        assert "show_ai_generate" in names_section

    async def test_get_new_returns_actor_name(self, client: httpx.AsyncClient) -> None:
        """GET new simulation returns actor_name from profile context."""
        response = await client.post(
            "/api/v5/artifacts/simulations/get",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        assert response.json()["actor_name"] is not None


class TestSimulationGetExisting:
    """Tests for POST /api/v5/artifacts/simulations/get with existing simulation_id."""

    async def test_get_existing_returns_simulation(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET with seed simulation_id returns simulation data."""
        response = await client.post(
            "/api/v5/artifacts/simulations/get",
            json={"simulation_id": SEED_SIMULATION_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["simulation_exists"] is True
        assert data["can_edit"] is True

    async def test_get_existing_has_name_resource(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET existing simulation returns name resource from seed data."""
        response = await client.post(
            "/api/v5/artifacts/simulations/get",
            json={"simulation_id": SEED_SIMULATION_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        names = response.json()["names"]
        assert names["resource"] is not None

    async def test_get_existing_has_description_resource(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET existing simulation returns description resource from seed data."""
        response = await client.post(
            "/api/v5/artifacts/simulations/get",
            json={"simulation_id": SEED_SIMULATION_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        descriptions = response.json()["descriptions"]
        assert descriptions["resource"] is not None

    async def test_get_existing_has_flags(self, client: httpx.AsyncClient) -> None:
        """GET existing simulation returns enriched flag configs."""
        response = await client.post(
            "/api/v5/artifacts/simulations/get",
            json={"simulation_id": SEED_SIMULATION_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        flags = response.json()["flags"]
        assert flags["current"] is not None
        if flags["current"]:
            first_flag = flags["current"][0]
            assert "key" in first_flag
            assert "label" in first_flag

    async def test_get_existing_has_scenarios(self, client: httpx.AsyncClient) -> None:
        """GET existing simulation returns scenarios section."""
        response = await client.post(
            "/api/v5/artifacts/simulations/get",
            json={"simulation_id": SEED_SIMULATION_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        scenarios = response.json()["scenarios"]
        assert scenarios is not None

    async def test_get_existing_returns_group_id(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET existing simulation returns group_id field."""
        response = await client.post(
            "/api/v5/artifacts/simulations/get",
            json={"simulation_id": SEED_SIMULATION_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        assert "group_id" in response.json()


class TestSimulationGetErrors:
    """Tests for POST /api/v5/artifacts/simulations/get error cases."""

    async def test_get_nonexistent_returns_404(self, client: httpx.AsyncClient) -> None:
        """GET with nonexistent simulation_id returns 404."""
        response = await client.post(
            "/api/v5/artifacts/simulations/get",
            json={"simulation_id": ZEROED_UUID},
            headers=HEADERS,
        )

        assert response.status_code == 404

    async def test_get_no_profile_returns_401(self, client: httpx.AsyncClient) -> None:
        """GET without X-Profile-Id returns 401."""
        response = await client.post(
            "/api/v5/artifacts/simulations/get",
            json={"simulation_id": SEED_SIMULATION_ID},
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
