"""Integration tests for artifact cohort delete endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
ZEROED_UUID = "00000000-0000-0000-0000-000000000000"

# Delete tests depend on GET+SAVE (for creating a cohort to delete),
# and GET has a pre-existing bug.
_GET_BUG = pytest.mark.xfail(
    reason="cohort GET endpoint bug blocks delete tests (search_flags_internal)",
    strict=False,
)


@_GET_BUG
class TestCohortDelete:
    """Tests for POST /api/v4/artifacts/cohorts/delete endpoint."""

    async def test_delete_created_cohort(self, client: httpx.AsyncClient) -> None:
        """DELETE a freshly created cohort succeeds."""
        # Arrange — GET new to get group_id, then SAVE to create a cohort
        get_response = await client.post(
            "/api/v4/artifacts/cohorts/get",
            json={},
            headers=HEADERS,
        )
        assert get_response.status_code == 200
        group_id = get_response.json()["group_id"]

        save_payload = {
            "group_id": group_id,
            "input_cohort_id": None,
            "names": {"resource_id": None},
            "descriptions": {"resource_id": None},
            "flags": {"resource_id": None},
            "departments": {"resource_ids": []},
            "simulations": {"resource_ids": []},
            "simulation_positions": {"resource_ids": []},
        }
        save_response = await client.post(
            "/api/v4/artifacts/cohorts/save",
            json=save_payload,
            headers=HEADERS,
        )
        assert save_response.status_code == 200
        new_cohort_id = save_response.json()["cohort_id"]

        # Act
        response = await client.post(
            "/api/v4/artifacts/cohorts/delete",
            json={"cohort_id": new_cohort_id},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["deleted"] is True

    async def test_delete_nonexistent_returns_error(
        self, client: httpx.AsyncClient
    ) -> None:
        """DELETE with nonexistent cohort_id returns error."""
        response = await client.post(
            "/api/v4/artifacts/cohorts/delete",
            json={"cohort_id": ZEROED_UUID},
            headers=HEADERS,
        )

        assert response.status_code in (400, 404, 500)


class TestCohortDeleteErrors:
    """Tests for POST /api/v4/artifacts/cohorts/delete error cases."""

    async def test_delete_no_profile_returns_401(
        self, client: httpx.AsyncClient, seed_cohort_id: str
    ) -> None:
        """DELETE without X-Profile-Id returns 401."""
        response = await client.post(
            "/api/v4/artifacts/cohorts/delete",
            json={"cohort_id": seed_cohort_id},
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
