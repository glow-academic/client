"""Integration tests for artifact setting delete endpoint."""

import httpx
import pytest

from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}
SEED_SETTING_ID = "019b3be4-3c61-7699-b40c-29d4bcb6e2b3"
SEED_NAME_ID = "019b995c-8eb2-79f4-ad14-da57e866749a"
SEED_DESCRIPTION_ID = "019b995c-8eb3-760f-b55d-98b8fc86ba42"
ZEROED_UUID = "00000000-0000-0000-0000-000000000000"


class TestSettingDelete:
    """Tests for POST /api/v4/artifacts/setting/delete endpoint."""

    async def test_delete_created_setting(self, client: httpx.AsyncClient) -> None:
        """DELETE a freshly created setting succeeds."""
        # Arrange — create a setting to delete
        save_payload = {
            "input_setting_id": None,
            "names": {"resource_id": SEED_NAME_ID},
            "descriptions": {"resource_id": SEED_DESCRIPTION_ID},
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
        save_response = await client.post(
            "/api/v4/artifacts/setting/save",
            json=save_payload,
            headers=HEADERS,
        )
        assert save_response.status_code == 200
        new_setting_id = save_response.json()["setting_id"]

        # Act
        response = await client.post(
            "/api/v4/artifacts/setting/delete",
            json={"setting_id": new_setting_id},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "deleted successfully" in data["message"]

    async def test_delete_nonexistent_returns_404(
        self, client: httpx.AsyncClient
    ) -> None:
        """DELETE with nonexistent setting_id returns 404."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/setting/delete",
            json={"setting_id": ZEROED_UUID},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 404


class TestSettingDeleteErrors:
    """Tests for POST /api/v4/artifacts/setting/delete error cases."""

    async def test_delete_no_profile_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        """DELETE without X-Profile-Id returns 401."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/setting/delete",
            json={"setting_id": SEED_SETTING_ID},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 401
