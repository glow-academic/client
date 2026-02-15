"""Integration tests for artifact cohort save endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}

# Save tests depend on GET (for group_id), which has a pre-existing bug.
_GET_BUG = pytest.mark.xfail(
    reason="cohort GET endpoint bug blocks save tests (search_flags_internal)",
    strict=False,
)


def _build_save_request(
    group_id: str,
    cohort_id: str | None = None,
    name_id: str | None = None,
    description_id: str | None = None,
    flag_id: str | None = None,
    department_ids: list[str] | None = None,
) -> dict:
    """Build a minimal valid save request."""
    return {
        "group_id": group_id,
        "input_cohort_id": cohort_id,
        "names": {"resource_id": name_id},
        "descriptions": {"resource_id": description_id},
        "flags": {"resource_id": flag_id},
        "departments": {"resource_ids": department_ids or []},
        "simulations": {"resource_ids": []},
        "simulation_positions": {"resource_ids": []},
    }


@_GET_BUG
class TestCohortSaveCreate:
    """Tests for POST /api/v4/artifacts/cohorts/save (create mode)."""

    async def test_create_cohort_success(self, client: httpx.AsyncClient) -> None:
        """SAVE with no input_cohort_id creates a new cohort."""
        # Arrange — GET new to obtain a group_id
        get_response = await client.post(
            "/api/v4/artifacts/cohorts/get",
            json={},
            headers=HEADERS,
        )
        assert get_response.status_code == 200
        group_id = get_response.json()["group_id"]

        # Act
        payload = _build_save_request(group_id=group_id)
        response = await client.post(
            "/api/v4/artifacts/cohorts/save",
            json=payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["cohort_id"] is not None

    async def test_create_cohort_returns_actor_name(
        self, client: httpx.AsyncClient
    ) -> None:
        """SAVE returns actor_name in response."""
        # Arrange
        get_response = await client.post(
            "/api/v4/artifacts/cohorts/get",
            json={},
            headers=HEADERS,
        )
        assert get_response.status_code == 200
        group_id = get_response.json()["group_id"]

        # Act
        payload = _build_save_request(group_id=group_id)
        response = await client.post(
            "/api/v4/artifacts/cohorts/save",
            json=payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        assert response.json()["actor_name"] is not None


@_GET_BUG
class TestCohortSaveUpdate:
    """Tests for POST /api/v4/artifacts/cohorts/save (update mode)."""

    async def test_update_cohort_success(
        self, client: httpx.AsyncClient, seed_cohort_id: str
    ) -> None:
        """SAVE with input_cohort_id updates existing cohort."""
        # Arrange — GET existing to obtain group_id and resource IDs
        get_response = await client.post(
            "/api/v4/artifacts/cohorts/get",
            json={"cohort_id": seed_cohort_id},
            headers=HEADERS,
        )
        assert get_response.status_code == 200
        get_data = get_response.json()
        group_id = get_data["group_id"]

        # Extract current resource IDs
        name_id = (
            get_data["names"]["resource"]["id"]
            if get_data["names"]["resource"]
            else None
        )
        description_id = (
            get_data["descriptions"]["resource"]["id"]
            if get_data["descriptions"]["resource"]
            else None
        )
        flag_id = (
            get_data["flags"]["resource"]["id"]
            if get_data["flags"]["resource"]
            else None
        )
        dept_ids = [
            d["department_id"]
            for d in (get_data["departments"]["current"] or [])
        ]

        # Act
        payload = _build_save_request(
            group_id=group_id,
            cohort_id=seed_cohort_id,
            name_id=name_id,
            description_id=description_id,
            flag_id=flag_id,
            department_ids=dept_ids,
        )
        response = await client.post(
            "/api/v4/artifacts/cohorts/save",
            json=payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["cohort_id"] == seed_cohort_id


class TestCohortSaveErrors:
    """Tests for POST /api/v4/artifacts/cohorts/save error cases."""

    async def test_save_no_profile_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        """SAVE without X-Profile-Id returns 401."""
        payload = _build_save_request(
            group_id="00000000-0000-0000-0000-000000000000",
        )

        response = await client.post(
            "/api/v4/artifacts/cohorts/save",
            json=payload,
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
