"""Integration tests for artifact setting list endpoint."""

import httpx
import pytest

from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}


class TestSettingList:
    """Tests for POST /api/v4/artifacts/settings/list endpoint."""

    async def test_list_returns_settings(self, client: httpx.AsyncClient) -> None:
        """LIST returns settings from seed data."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/list",
            json={},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["settings"] is not None
        assert len(data["settings"]) > 0

    async def test_list_returns_actor_name(self, client: httpx.AsyncClient) -> None:
        """LIST returns actor_name from profile context."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/list",
            json={},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["actor_name"] is not None

    async def test_list_returns_user_role(self, client: httpx.AsyncClient) -> None:
        """LIST returns user_role from profile context."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/list",
            json={},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["user_role"] is not None

    async def test_list_settings_have_permissions(
        self, client: httpx.AsyncClient
    ) -> None:
        """LIST settings include computed permission fields."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/list",
            json={},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        settings = data["settings"]
        assert len(settings) > 0
        first_setting = settings[0]
        assert "can_edit" in first_setting
        assert "can_delete" in first_setting
        assert "can_duplicate" in first_setting

    async def test_list_settings_have_core_fields(
        self, client: httpx.AsyncClient
    ) -> None:
        """LIST settings include core identifying fields."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/list",
            json={},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        settings = response.json()["settings"]
        assert len(settings) > 0
        first_setting = settings[0]
        assert "settings_id" in first_setting
        assert "name" in first_setting
        assert "created_at" in first_setting

    async def test_list_returns_keys(self, client: httpx.AsyncClient) -> None:
        """LIST returns keys array (may be empty or populated from seed)."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/list",
            json={},
            headers=HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "keys" in data

    async def test_list_no_profile_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        """LIST without X-Profile-Id returns 401."""
        # Act
        response = await client.post(
            "/api/v4/artifacts/settings/list",
            json={},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 401
