"""Integration tests for artifact simulation draft endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
# Seed resource IDs from first simulation
SEED_NAME_ID = "019b995c-8e93-7fce-9bc7-b9778a79bb71"
SEED_DESCRIPTION_ID = "019b995c-8e96-7744-a761-ac55cbd07862"


class TestSimulationDraft:
    """Tests for PATCH /api/v4/artifacts/simulations/draft endpoint."""

    async def test_draft_creates_new_draft(self, client: httpx.AsyncClient) -> None:
        """DRAFT with no input_draft_id creates a new draft."""
        payload = {
            "input_draft_id": None,
            "names": {"resource_id": SEED_NAME_ID},
            "expected_version": 0,
        }

        response = await client.patch(
            "/api/v4/artifacts/simulations/draft",
            json=payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["draft_id"] is not None
        assert data["new_version"] is not None

    async def test_draft_updates_existing_draft(
        self, client: httpx.AsyncClient
    ) -> None:
        """DRAFT with input_draft_id updates the existing draft."""
        # First create a draft
        create_payload = {
            "input_draft_id": None,
            "names": {"resource_id": SEED_NAME_ID},
            "expected_version": 0,
        }
        create_response = await client.patch(
            "/api/v4/artifacts/simulations/draft",
            json=create_payload,
            headers=HEADERS,
        )
        assert create_response.status_code == 200
        draft_id = create_response.json()["draft_id"]
        new_version = create_response.json()["new_version"]

        # Then update it
        update_payload = {
            "input_draft_id": draft_id,
            "descriptions": {"resource_id": SEED_DESCRIPTION_ID},
            "expected_version": new_version,
        }
        response = await client.patch(
            "/api/v4/artifacts/simulations/draft",
            json=update_payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["draft_id"] is not None
        assert data["new_version"] is not None
        assert data["new_version"] > new_version


class TestSimulationDraftErrors:
    """Tests for PATCH /api/v4/artifacts/simulations/draft error cases."""

    async def test_draft_no_profile_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        """DRAFT without X-Profile-Id returns 401."""
        payload = {
            "input_draft_id": None,
            "names": {"resource_id": SEED_NAME_ID},
            "expected_version": 0,
        }

        response = await client.patch(
            "/api/v4/artifacts/simulations/draft",
            json=payload,
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
