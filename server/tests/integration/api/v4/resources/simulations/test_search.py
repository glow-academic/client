"""Integration tests for resource simulations search endpoint."""

import httpx
import pytest
from tests.seed_helpers import TEST_SUPERADMIN_PROFILE_ID

pytestmark = pytest.mark.asyncio(loop_scope="session")

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
HEADERS = {**BYPASS_CACHE_HEADERS, "X-Profile-Id": TEST_SUPERADMIN_PROFILE_ID}


class TestResourceSimulationsSearch:
    """Tests for POST /api/v4/resources/simulations/search endpoint."""

    async def test_search_returns_simulations(
        self, client: httpx.AsyncClient
    ) -> None:
        """SEARCH with no filters returns simulations from seed data."""
        response = await client.post(
            "/api/v4/resources/simulations/search",
            json={},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["items"] is not None
        assert len(data["items"]) > 0

    async def test_search_with_search_term(
        self, client: httpx.AsyncClient
    ) -> None:
        """SEARCH with a search term filters results."""
        response = await client.post(
            "/api/v4/resources/simulations/search",
            json={"search": "Practice"},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["items"] is not None

    async def test_search_respects_limit(
        self, client: httpx.AsyncClient
    ) -> None:
        """SEARCH respects limit_count parameter."""
        response = await client.post(
            "/api/v4/resources/simulations/search",
            json={"limit_count": 1},
            headers=HEADERS,
        )

        assert response.status_code == 200
        data = response.json()
        assert data["items"] is not None
        assert len(data["items"]) <= 1

    async def test_search_no_profile_returns_401(
        self, client: httpx.AsyncClient
    ) -> None:
        """SEARCH without X-Profile-Id returns 401."""
        response = await client.post(
            "/api/v4/resources/simulations/search",
            json={},
            headers=BYPASS_CACHE_HEADERS,
        )

        assert response.status_code == 401
