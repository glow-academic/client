"""Integration tests for resource names create endpoint."""

import pytest

import httpx

from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}


class TestCreateNames:
    """Tests for POST /api/v4/resources/names endpoint."""

    async def test_create_names_success(self, client: httpx.AsyncClient) -> None:
        """CREATE with valid data returns created ID."""
        # Arrange
        headers = {
            **BYPASS_CACHE_HEADERS,
            "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID,
        }

        # Act
        response = await client.post(
            "/api/v4/resources/names",
            json={"name": "Test Integration Name"},
            headers=headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["name_id"] is not None

    async def test_create_names_no_profile(self, client: httpx.AsyncClient) -> None:
        """CREATE without X-Profile-Id returns 401."""
        # Act
        response = await client.post(
            "/api/v4/resources/names",
            json={"name": "Test Name No Profile"},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 401
