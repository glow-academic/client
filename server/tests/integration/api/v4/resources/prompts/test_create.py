"""Integration tests for resource prompts create endpoint."""

import pytest

import httpx

from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}


class TestCreatePrompts:
    """Tests for POST /api/v4/resources/prompts endpoint."""

    async def test_create_prompts_success(self, client: httpx.AsyncClient) -> None:
        """CREATE with valid data returns created ID."""
        # Arrange
        headers = {
            **BYPASS_CACHE_HEADERS,
            "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID,
        }

        # Act
        response = await client.post(
            "/api/v4/resources/prompts",
            json={
                "system_prompt": "You are a test assistant.",
                "name": "Test Prompt",
                "description": "A test prompt for integration tests",
            },
            headers=headers,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["prompt_id"] is not None

    async def test_create_prompts_no_profile(self, client: httpx.AsyncClient) -> None:
        """CREATE without X-Profile-Id returns 401."""
        # Act
        response = await client.post(
            "/api/v4/resources/prompts",
            json={
                "system_prompt": "Test",
                "name": "Test",
                "description": "Test",
            },
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 401
