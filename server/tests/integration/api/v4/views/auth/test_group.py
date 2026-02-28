"""Integration tests for auth group messages endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}


class TestGroupMessages:
    """Tests for POST /api/v4/auth/group endpoint."""

    async def test_group_returns_200_with_valid_group_id(
        self, client: httpx.AsyncClient
    ) -> None:
        """GROUP endpoint returns 200 even when group doesn't exist (empty response)."""
        response = await client.post(
            "/api/v4/auth/group",
            json={
                "group_id": "00000000-0000-0000-0000-000000000000",
                "page_limit": 10,
                "page_offset": 0,
            },
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        # Non-existent group returns null/empty fields
        assert data.get("total_message_count", 0) == 0

    async def test_group_returns_expected_shape(
        self, client: httpx.AsyncClient
    ) -> None:
        """GROUP endpoint returns the expected response shape."""
        response = await client.post(
            "/api/v4/auth/group",
            json={
                "group_id": "00000000-0000-0000-0000-000000000000",
            },
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        # All fields should be present (nullable)
        assert "group_id" in data
        assert "group_name" in data
        assert "group_created_at" in data
        assert "session_id" in data
        assert "messages" in data
        assert "total_message_count" in data

    async def test_group_default_pagination(self, client: httpx.AsyncClient) -> None:
        """GROUP endpoint uses default pagination when not specified."""
        response = await client.post(
            "/api/v4/auth/group",
            json={
                "group_id": "00000000-0000-0000-0000-000000000000",
            },
            headers=HEADERS,
        )

        assert response.status_code == 200

    async def test_group_validates_group_id(self, client: httpx.AsyncClient) -> None:
        """GROUP endpoint validates that group_id is a valid UUID."""
        response = await client.post(
            "/api/v4/auth/group",
            json={
                "group_id": "not-a-uuid",
            },
            headers=HEADERS,
        )

        assert response.status_code == 422

    async def test_group_requires_group_id(self, client: httpx.AsyncClient) -> None:
        """GROUP endpoint requires group_id field."""
        response = await client.post(
            "/api/v4/auth/group",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 422
