"""Integration tests for resource keys create endpoint."""

from uuid import uuid4

import pytest

import httpx

from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}


class TestCreateKeys:
    """Tests for POST /api/v4/resources/keys endpoint."""

    async def test_create_keys_success(self, client: httpx.AsyncClient) -> None:
        """CREATE with valid data returns created ID."""
        # Arrange
        headers = {
            **BYPASS_CACHE_HEADERS,
            "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID,
        }

        # Act
        response = await client.post(
            "/api/v4/resources/keys",
            json={"key_id": str(uuid4())},
            headers=headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["id"] is not None

    async def test_create_keys_no_profile(self, client: httpx.AsyncClient) -> None:
        """CREATE without X-Profile-Id returns 401."""
        # Act
        response = await client.post(
            "/api/v4/resources/keys",
            json={"key_id": str(uuid4())},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 401
