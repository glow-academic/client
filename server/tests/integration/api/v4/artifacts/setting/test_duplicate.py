"""Integration tests for artifact setting duplicate endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
SEED_SETTING_ID = "019b3be4-3c61-7699-b40c-29d4bcb6e2b3"
ZEROED_UUID = "00000000-0000-0000-0000-000000000000"


class TestSettingDuplicate:
    """Tests for POST /api/v4/artifacts/settings/duplicate endpoint."""

    async def test_duplicate_seed_setting(self, client: httpx.AsyncClient) -> None:
        """DUPLICATE the seed setting creates a new copy."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/duplicate",
            json={"setting_id": SEED_SETTING_ID},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["setting_id"] is not None
        assert data["setting_id"] != SEED_SETTING_ID

    async def test_duplicate_returns_message(self, client: httpx.AsyncClient) -> None:
        """DUPLICATE returns a success message with original name."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/duplicate",
            json={"setting_id": SEED_SETTING_ID},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "duplicated successfully" in data["message"]

    async def test_duplicate_nonexistent_returns_error(
        self, client: httpx.AsyncClient
    ) -> None:
        """DUPLICATE with nonexistent setting_id returns error."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/duplicate",
            json={"setting_id": ZEROED_UUID},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 400


class TestSettingDuplicateErrors:
    """Tests for POST /api/v4/artifacts/settings/duplicate error cases."""

    async def test_duplicate_no_profile_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        """DUPLICATE without X-Profile-Id returns 401."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/duplicate",
            json={"setting_id": SEED_SETTING_ID},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 401
