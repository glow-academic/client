"""Integration tests for resource agents search endpoint."""

import pytest

import asyncpg
import httpx

from app.api.v4.resources.agents.search import search_agents_internal

pytestmark = pytest.mark.asyncio

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}


class TestSearchAgents:
    """Tests for POST /api/v4/resources/agents/search endpoint."""

    async def test_search_agents_returns_items(
        self, client: httpx.AsyncClient
    ) -> None:
        """SEARCH with no filters returns items."""
        # Act
        response = await client.post(
            "/api/v4/resources/agents/search",
            json={},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) > 0

    async def test_search_agents_with_limit(self, client: httpx.AsyncClient) -> None:
        """SEARCH with limit_count=1 returns at most 1 item."""
        # Act
        response = await client.post(
            "/api/v4/resources/agents/search",
            json={"limit_count": 1},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        assert len(response.json()["items"]) <= 1

    async def test_search_agents_with_offset(self, client: httpx.AsyncClient) -> None:
        """SEARCH with large offset returns 0 items."""
        # Act
        response = await client.post(
            "/api/v4/resources/agents/search",
            json={"offset_count": 999999},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        assert len(response.json()["items"]) == 0

    async def test_search_agents_with_search_text(
        self, client: httpx.AsyncClient
    ) -> None:
        """SEARCH with search text filters results."""
        # Act
        response = await client.post(
            "/api/v4/resources/agents/search",
            json={"search": "assistant"},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200


class TestSearchAgentsInternal:
    """Tests for search_agents_internal function."""

    async def test_returns_items(self, db: asyncpg.Connection) -> None:
        """Internal function returns items with no filters."""
        # Act
        items = await search_agents_internal(db, bypass_cache=True)

        # Assert
        assert len(items) > 0

    async def test_respects_limit(self, db: asyncpg.Connection) -> None:
        """Internal function respects limit_count."""
        # Act
        items = await search_agents_internal(db, limit_count=1, bypass_cache=True)

        # Assert
        assert len(items) <= 1

    async def test_returns_empty_for_zero_limit(self, db: asyncpg.Connection) -> None:
        """Internal function returns empty list for limit_count=0."""
        # Act
        items = await search_agents_internal(db, limit_count=0, bypass_cache=True)

        # Assert
        assert items == []
