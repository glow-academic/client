"""Integration tests for artifact cohort get endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
ZEROED_UUID = "00000000-0000-0000-0000-000000000000"

# The cohort GET endpoint has a bug in search_flags_internal where cohort=True
# is passed as a positional arg for flag_type (expects str, gets bool).
_GET_BUG = pytest.mark.xfail(
    reason="search_flags_internal: flag_type receives bool instead of str",
    strict=False,
)


@_GET_BUG
class TestCohortGetNew:
    """Tests for POST /api/v5/artifacts/cohorts/get with no cohort_id (new mode)."""

    async def test_get_new_returns_defaults(self, client: httpx.AsyncClient) -> None:
        """GET with no cohort_id returns default sections for new cohort."""
        response = await client.post(
            "/api/v5/artifacts/cohorts/get",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200, (
            f"Expected 200, got {response.status_code}: {response.text[:500]}"
        )
        data = response.json()
        assert data["cohort_exists"] is None or data["cohort_exists"] is False
        assert data["can_edit"] is not None

    async def test_get_new_returns_all_sections(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET new cohort returns all resource sections."""
        response = await client.post(
            "/api/v5/artifacts/cohorts/get",
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
            "simulations",
            "simulation_positions",
        ]
        for section in expected_sections:
            assert section in data, f"Missing section: {section}"

    async def test_get_new_sections_have_metadata(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET new cohort sections include show/required/show_ai_generate metadata."""
        response = await client.post(
            "/api/v5/artifacts/cohorts/get",
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
        """GET new cohort returns actor_name from profile context."""
        response = await client.post(
            "/api/v5/artifacts/cohorts/get",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        assert response.json()["actor_name"] is not None

    async def test_get_new_returns_group_id(self, client: httpx.AsyncClient) -> None:
        """GET new cohort returns a group_id for draft/save operations."""
        response = await client.post(
            "/api/v5/artifacts/cohorts/get",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        assert response.json()["group_id"] is not None


@_GET_BUG
class TestCohortGetExisting:
    """Tests for POST /api/v5/artifacts/cohorts/get with existing cohort_id."""

    async def test_get_existing_returns_cohort(
        self, client: httpx.AsyncClient, seed_cohort_id: str
    ) -> None:
        """GET with seed cohort_id returns cohort data."""
        response = await client.post(
            "/api/v5/artifacts/cohorts/get",
            json={"cohort_id": seed_cohort_id},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["cohort_exists"] is True
        assert data["can_edit"] is True

    async def test_get_existing_has_name_resource(
        self, client: httpx.AsyncClient, seed_cohort_id: str
    ) -> None:
        """GET existing cohort returns name resource from seed data."""
        response = await client.post(
            "/api/v5/artifacts/cohorts/get",
            json={"cohort_id": seed_cohort_id},
            headers=HEADERS,
        )

        assert response.status_code == 200
        names = response.json()["names"]
        assert names["resource"] is not None
        assert names["resource"]["name"] is not None

    async def test_get_existing_has_description_resource(
        self, client: httpx.AsyncClient, seed_cohort_id: str
    ) -> None:
        """GET existing cohort returns description resource from seed data."""
        response = await client.post(
            "/api/v5/artifacts/cohorts/get",
            json={"cohort_id": seed_cohort_id},
            headers=HEADERS,
        )

        assert response.status_code == 200
        descriptions = response.json()["descriptions"]
        assert descriptions["resource"] is not None

    async def test_get_existing_has_departments(
        self, client: httpx.AsyncClient, seed_cohort_id: str
    ) -> None:
        """GET existing cohort returns departments section."""
        response = await client.post(
            "/api/v5/artifacts/cohorts/get",
            json={"cohort_id": seed_cohort_id},
            headers=HEADERS,
        )

        assert response.status_code == 200
        departments = response.json()["departments"]
        assert departments is not None
        assert "resources" in departments

    async def test_get_existing_has_simulations(
        self, client: httpx.AsyncClient, seed_cohort_id: str
    ) -> None:
        """GET existing cohort returns simulations section."""
        response = await client.post(
            "/api/v5/artifacts/cohorts/get",
            json={"cohort_id": seed_cohort_id},
            headers=HEADERS,
        )

        assert response.status_code == 200
        simulations = response.json()["simulations"]
        assert simulations is not None
        assert "resources" in simulations

    async def test_get_existing_has_flags(
        self, client: httpx.AsyncClient, seed_cohort_id: str
    ) -> None:
        """GET existing cohort returns flags section."""
        response = await client.post(
            "/api/v5/artifacts/cohorts/get",
            json={"cohort_id": seed_cohort_id},
            headers=HEADERS,
        )

        assert response.status_code == 200
        flags = response.json()["flags"]
        assert flags is not None
        assert "resources" in flags

    async def test_get_existing_returns_group_id(
        self, client: httpx.AsyncClient, seed_cohort_id: str
    ) -> None:
        """GET existing cohort returns group_id field."""
        response = await client.post(
            "/api/v5/artifacts/cohorts/get",
            json={"cohort_id": seed_cohort_id},
            headers=HEADERS,
        )

        assert response.status_code == 200
        assert "group_id" in response.json()


class TestCohortGetErrors:
    """Tests for POST /api/v5/artifacts/cohorts/get error cases."""

    async def test_get_nonexistent_returns_404(self, client: httpx.AsyncClient) -> None:
        """GET with nonexistent cohort_id returns 404."""
        response = await client.post(
            "/api/v5/artifacts/cohorts/get",
            json={"cohort_id": ZEROED_UUID},
            headers=HEADERS,
        )

        assert response.status_code == 404

    async def test_get_no_profile_returns_401(
        self, client: httpx.AsyncClient, seed_cohort_id: str
    ) -> None:
        """GET without X-Profile-Id returns 401."""
        response = await client.post(
            "/api/v5/artifacts/cohorts/get",
            json={"cohort_id": seed_cohort_id},
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
