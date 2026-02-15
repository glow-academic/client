"""Integration tests for artifact persona draft endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
SEED_NAME_ID = "019b995c-8e99-785b-9fa2-bd32bc0588c4"


class TestPersonaDraft:
    """Tests for PATCH /api/v4/artifacts/personas/draft endpoint."""

    async def test_create_draft_success(self, client: httpx.AsyncClient) -> None:
        """DRAFT with no input_draft_id creates a new draft."""
        payload = {
            "name_id": SEED_NAME_ID,
            "expected_version": 0,
        }

        response = await client.patch(
            "/api/v4/artifacts/personas/draft",
            json=payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["draft_id"] is not None
        assert data["new_version"] >= 0

    async def test_create_draft_returns_message(
        self, client: httpx.AsyncClient
    ) -> None:
        """DRAFT returns a success message."""
        payload = {
            "name_id": SEED_NAME_ID,
            "expected_version": 0,
        }

        response = await client.patch(
            "/api/v4/artifacts/personas/draft",
            json=payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        assert response.json()["message"] is not None

    async def test_update_draft_with_existing_id(
        self, client: httpx.AsyncClient
    ) -> None:
        """DRAFT with existing draft_id updates the draft."""
        # Arrange — create a draft first
        create_payload = {
            "name_id": SEED_NAME_ID,
            "expected_version": 0,
        }
        create_response = await client.patch(
            "/api/v4/artifacts/personas/draft",
            json=create_payload,
            headers=HEADERS,
        )
        assert create_response.status_code == 200
        draft_id = create_response.json()["draft_id"]
        new_version = create_response.json()["new_version"]

        # Act — update the same draft
        update_payload = {
            "input_draft_id": draft_id,
            "description_id": None,
            "expected_version": new_version,
        }
        response = await client.patch(
            "/api/v4/artifacts/personas/draft",
            json=update_payload,
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["draft_id"] == draft_id
        assert data["new_version"] > new_version


class TestPersonaDraftErrors:
    """Tests for PATCH /api/v4/artifacts/personas/draft error cases."""

    async def test_draft_no_profile_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        """DRAFT without X-Profile-Id returns 401."""
        payload = {
            "name_id": SEED_NAME_ID,
            "expected_version": 0,
        }

        response = await client.patch(
            "/api/v4/artifacts/personas/draft",
            json=payload,
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
