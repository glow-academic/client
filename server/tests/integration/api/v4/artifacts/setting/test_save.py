"""Integration tests for artifact setting save endpoint."""

import httpx
import pytest

from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
SEED_SETTING_ID = "019b3be4-3c61-7699-b40c-29d4bcb6e2b3"
SEED_NAME_ID = "019b995c-8eb2-79f4-ad14-da57e866749a"
SEED_DESCRIPTION_ID = "019b995c-8eb3-760f-b55d-98b8fc86ba42"


def _build_save_request(
    setting_id: str | None = None,
    name_id: str | None = SEED_NAME_ID,
    description_id: str | None = SEED_DESCRIPTION_ID,
) -> dict:
    """Build a minimal valid save request."""
    return {
        "input_setting_id": setting_id,
        "names": {"resource_id": name_id},
        "descriptions": {"resource_id": description_id},
        "colors": {"resource_ids": []},
        "flags": {},
        "departments": {"resource_ids": []},
        "profiles": {"resource_ids": []},
        "auths": {"resource_ids": []},
        "provider_keys": {"resource_ids": []},
        "auth_item_keys": {"resource_ids": []},
        "roles": {"resource_ids": []},
        "role_routes": {"resource_ids": []},
    }


class TestSettingSaveCreate:
    """Tests for POST /api/v4/artifacts/setting/save (create mode)."""

    async def test_create_setting_success(self, client: httpx.AsyncClient) -> None:
        """SAVE with no input_setting_id creates a new setting."""
        # Arrange
        payload = _build_save_request(setting_id=None)

        # Act
        response = await client.post(
            "/api/v4/artifacts/setting/save",
            json=payload,
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["setting_id"] is not None

    async def test_create_setting_returns_actor_name(
        self, client: httpx.AsyncClient
    ) -> None:
        """SAVE returns actor_name from profile context."""
        # Arrange
        payload = _build_save_request(setting_id=None)

        # Act
        response = await client.post(
            "/api/v4/artifacts/setting/save",
            json=payload,
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        assert response.json()["actor_name"] is not None


class TestSettingSaveUpdate:
    """Tests for POST /api/v4/artifacts/setting/save (update mode)."""

    async def test_update_setting_success(self, client: httpx.AsyncClient) -> None:
        """SAVE with input_setting_id updates existing setting."""
        # Arrange
        payload = _build_save_request(setting_id=SEED_SETTING_ID)

        # Act
        response = await client.post(
            "/api/v4/artifacts/setting/save",
            json=payload,
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["setting_id"] == SEED_SETTING_ID


class TestSettingSaveErrors:
    """Tests for POST /api/v4/artifacts/setting/save error cases."""

    async def test_save_no_profile_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        """SAVE without X-Profile-Id returns 401."""
        # Arrange
        payload = _build_save_request(setting_id=None)

        # Act
        response = await client.post(
            "/api/v4/artifacts/setting/save",
            json=payload,
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 401
