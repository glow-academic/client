"""Integration tests for artifact persona duplicate endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
SEED_PERSONA_ID = "019b3be4-36e2-770b-af4e-96c8cfa80851"
ZEROED_UUID = "00000000-0000-0000-0000-000000000000"


class TestPersonaDuplicate:
    """Tests for POST /api/v5/artifacts/personas/duplicate endpoint."""

    async def test_duplicate_seed_persona(self, client: httpx.AsyncClient) -> None:
        """DUPLICATE the seed persona creates a new copy."""
        response = await client.post(
            "/api/v5/artifacts/personas/duplicate",
            json={"persona_id": SEED_PERSONA_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["persona_id"] is not None
        assert data["persona_id"] != SEED_PERSONA_ID

    async def test_duplicate_returns_message(self, client: httpx.AsyncClient) -> None:
        """DUPLICATE returns a success message with original name."""
        response = await client.post(
            "/api/v5/artifacts/personas/duplicate",
            json={"persona_id": SEED_PERSONA_ID},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert "duplicated successfully" in data["message"]

    async def test_duplicate_nonexistent_returns_error(
        self, client: httpx.AsyncClient
    ) -> None:
        """DUPLICATE with nonexistent persona_id returns error."""
        response = await client.post(
            "/api/v5/artifacts/personas/duplicate",
            json={"persona_id": ZEROED_UUID},
            headers=HEADERS,
        )

        assert response.status_code == 400


class TestPersonaDuplicateErrors:
    """Tests for POST /api/v5/artifacts/personas/duplicate error cases."""

    async def test_duplicate_no_profile_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        """DUPLICATE without X-Profile-Id returns 401."""
        response = await client.post(
            "/api/v5/artifacts/personas/duplicate",
            json={"persona_id": SEED_PERSONA_ID},
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
