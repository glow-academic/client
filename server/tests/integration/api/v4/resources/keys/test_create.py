"""Integration tests for resource keys create endpoint."""

import httpx
import pytest

pytestmark = pytest.mark.asyncio

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}


class TestCreateKeys:
    """Tests for POST /api/v4/resources/keys endpoint."""

    async def test_create_keys_no_profile(self, client: httpx.AsyncClient) -> None:
        """CREATE without X-Profile-Id returns 401."""
        # Act
        response = await client.post(
            "/api/v4/resources/keys",
            json={"key_id": "00000000-0000-0000-0000-000000000001"},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 401
