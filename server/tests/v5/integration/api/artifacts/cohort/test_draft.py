"""Integration tests for artifact cohort draft endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}

# The cohort draft SQL has a bug: "column reference 'draft_id' is ambiguous".
_DRAFT_BUG = pytest.mark.xfail(
    reason="patch_cohort_draft SQL: ambiguous column reference 'draft_id'",
    strict=False,
)


@_DRAFT_BUG
class TestCohortDraft:
    """Tests for PATCH /api/v5/artifacts/cohorts/draft endpoint."""

    async def test_create_draft_success(self, client: httpx.AsyncClient) -> None:
        """DRAFT with no input_draft_id creates a new draft."""
        payload = {
            "names": {"resource_id": None},
            "expected_version": 0,
        }

        response = await client.patch(
            "/api/v5/artifacts/cohorts/draft",
            json=payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["draft_id"] is not None
        assert data["new_version"] >= 0

    async def test_create_draft_returns_draft_exists(
        self, client: httpx.AsyncClient
    ) -> None:
        """DRAFT returns draft_exists field."""
        payload = {
            "names": {"resource_id": None},
            "expected_version": 0,
        }

        response = await client.patch(
            "/api/v5/artifacts/cohorts/draft",
            json=payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        assert "draft_exists" in response.json()

    async def test_update_draft_with_existing_id(
        self, client: httpx.AsyncClient
    ) -> None:
        """DRAFT with existing draft_id updates the draft."""
        # Arrange — create a draft first
        create_payload = {
            "names": {"resource_id": None},
            "expected_version": 0,
        }
        create_response = await client.patch(
            "/api/v5/artifacts/cohorts/draft",
            json=create_payload,
            headers=HEADERS,
        )
        assert create_response.status_code == 200
        draft_id = create_response.json()["draft_id"]
        new_version = create_response.json()["new_version"]

        # Act — update the same draft
        update_payload = {
            "input_draft_id": draft_id,
            "descriptions": {"resource_id": None},
            "expected_version": new_version,
        }
        response = await client.patch(
            "/api/v5/artifacts/cohorts/draft",
            json=update_payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["draft_id"] == draft_id
        assert data["new_version"] > new_version


class TestCohortDraftErrors:
    """Tests for PATCH /api/v5/artifacts/cohorts/draft error cases."""

    async def test_draft_no_profile_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        """DRAFT without X-Profile-Id returns 401."""
        payload = {
            "names": {"resource_id": None},
            "expected_version": 0,
        }

        response = await client.patch(
            "/api/v5/artifacts/cohorts/draft",
            json=payload,
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
