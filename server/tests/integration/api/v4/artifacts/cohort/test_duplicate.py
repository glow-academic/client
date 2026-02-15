"""Integration tests for artifact cohort duplicate endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
ZEROED_UUID = "00000000-0000-0000-0000-000000000000"


class TestCohortDuplicate:
    """Tests for POST /api/v4/artifacts/cohorts/duplicate endpoint."""

    async def test_duplicate_seed_cohort(
        self, client: httpx.AsyncClient, seed_cohort_id: str
    ) -> None:
        """DUPLICATE the seed cohort creates a new copy."""
        response = await client.post(
            "/api/v4/artifacts/cohorts/duplicate",
            json={"cohort_id": seed_cohort_id},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] is not None
        assert data["id"] != seed_cohort_id

    async def test_duplicate_returns_title(
        self, client: httpx.AsyncClient, seed_cohort_id: str
    ) -> None:
        """DUPLICATE returns the title of the new copy."""
        response = await client.post(
            "/api/v4/artifacts/cohorts/duplicate",
            json={"cohort_id": seed_cohort_id},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "title" in data

    async def test_duplicate_nonexistent_returns_error(
        self, client: httpx.AsyncClient
    ) -> None:
        """DUPLICATE with nonexistent cohort_id returns error."""
        response = await client.post(
            "/api/v4/artifacts/cohorts/duplicate",
            json={"cohort_id": ZEROED_UUID},
            headers=HEADERS,
        )

        assert response.status_code in (400, 404)


class TestCohortDuplicateErrors:
    """Tests for POST /api/v4/artifacts/cohorts/duplicate error cases."""

    async def test_duplicate_no_profile_returns_401(
        self, client: httpx.AsyncClient, seed_cohort_id: str
    ) -> None:
        """DUPLICATE without X-Profile-Id returns 401."""
        response = await client.post(
            "/api/v4/artifacts/cohorts/duplicate",
            json={"cohort_id": seed_cohort_id},
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
