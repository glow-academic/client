"""Integration tests for resource descriptions search endpoint."""

import asyncpg
import httpx
import pytest

from app.api.v4.resources.descriptions.search import search_descriptions_internal

pytestmark = pytest.mark.asyncio

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}


class TestSearchDescriptions:
    """Tests for POST /api/v4/resources/descriptions/search endpoint."""

    async def test_search_descriptions_returns_items(
        self, client: httpx.AsyncClient
    ) -> None:
        """SEARCH with no filters returns items."""
        # Act
        response = await client.post(
            "/api/v4/resources/descriptions/search",
            json={},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) > 0

    async def test_search_descriptions_with_limit(
        self, client: httpx.AsyncClient
    ) -> None:
        """SEARCH with limit_count=1 returns at most 1 item."""
        # Act
        response = await client.post(
            "/api/v4/resources/descriptions/search",
            json={"limit_count": 1},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        assert len(response.json()["items"]) <= 1

    async def test_search_descriptions_with_offset(
        self, client: httpx.AsyncClient
    ) -> None:
        """SEARCH with large offset returns 0 items."""
        # Act
        response = await client.post(
            "/api/v4/resources/descriptions/search",
            json={"offset_count": 999999},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        assert len(response.json()["items"]) == 0

    async def test_search_descriptions_with_search_text(
        self, client: httpx.AsyncClient
    ) -> None:
        """SEARCH with search text filters results."""
        # Act
        response = await client.post(
            "/api/v4/resources/descriptions/search",
            json={"search": "agent"},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200


class TestSearchDescriptionsInternal:
    """Tests for search_descriptions_internal function."""

    async def test_returns_items(self, db: asyncpg.Connection) -> None:
        """Internal function returns items with no filters."""
        # Act
        items = await search_descriptions_internal(db, bypass_cache=True)

        # Assert
        assert len(items) > 0

    async def test_respects_limit(self, db: asyncpg.Connection) -> None:
        """Internal function respects limit_count."""
        # Act
        items = await search_descriptions_internal(db, limit_count=1, bypass_cache=True)

        # Assert
        assert len(items) <= 1

    async def test_returns_empty_for_zero_limit(self, db: asyncpg.Connection) -> None:
        """Internal function returns empty list for limit_count=0."""
        # Act
        items = await search_descriptions_internal(db, limit_count=0, bypass_cache=True)

        # Assert
        assert items == []
