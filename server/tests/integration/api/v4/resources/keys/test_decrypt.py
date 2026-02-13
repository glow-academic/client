"""Integration tests for resource keys decrypt endpoint."""

import pytest

import httpx

from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
ZEROED_UUID = "00000000-0000-0000-0000-000000000000"


class TestDecryptKeys:
    """Tests for POST /api/v4/resources/keys/decrypt endpoint."""

    async def test_decrypt_key_not_found(self, client: httpx.AsyncClient) -> None:
        """Decrypt with nonexistent key_id returns 400."""
        # Arrange
        headers = {
            **BYPASS_CACHE_HEADERS,
            "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID,
        }

        # Act
        response = await client.post(
            "/api/v4/resources/keys/decrypt",
            json={"key_id": ZEROED_UUID},
            headers=headers,
        )

        # Assert
        assert response.status_code == 400

    async def test_decrypt_key_no_profile(self, client: httpx.AsyncClient) -> None:
        """Decrypt without X-Profile-Id returns 401."""
        # Act
        response = await client.post(
            "/api/v4/resources/keys/decrypt",
            json={"key_id": ZEROED_UUID},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 401
