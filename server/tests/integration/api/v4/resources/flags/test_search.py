"""Integration tests for resource flags search endpoint."""

import asyncpg
import httpx
import pytest

from app.api.v4.resources.flags.search import search_flags_internal

pytestmark = pytest.mark.asyncio

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}


class TestSearchFlags:
    """Tests for POST /api/v4/resources/flags/search endpoint."""

    async def test_search_flags_returns_items(self, client: httpx.AsyncClient) -> None:
        """SEARCH with no filters returns items."""
        # Act
        response = await client.post(
            "/api/v4/resources/flags/search",
            json={},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) > 0

    async def test_search_flags_with_limit(self, client: httpx.AsyncClient) -> None:
        """SEARCH with limit_count=1 returns at most 1 item."""
        # Act
        response = await client.post(
            "/api/v4/resources/flags/search",
            json={"limit_count": 1},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        assert len(response.json()["items"]) <= 1

    async def test_search_flags_with_offset(self, client: httpx.AsyncClient) -> None:
        """SEARCH with large offset returns 0 items."""
        # Act
        response = await client.post(
            "/api/v4/resources/flags/search",
            json={"offset_count": 999999},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        assert len(response.json()["items"]) == 0

    async def test_search_flags_with_search_text(
        self, client: httpx.AsyncClient
    ) -> None:
        """SEARCH with search text filters results."""
        # Act
        response = await client.post(
            "/api/v4/resources/flags/search",
            json={"search": "flag"},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200


class TestSearchFlagsInternal:
    """Tests for search_flags_internal function."""

    async def test_returns_items(self, db: asyncpg.Connection) -> None:
        """Internal function returns items with no filters."""
        # Act
        items = await search_flags_internal(db, bypass_cache=True)

        # Assert
        assert len(items) > 0

    async def test_respects_limit(self, db: asyncpg.Connection) -> None:
        """Internal function respects limit_count."""
        # Act
        items = await search_flags_internal(db, limit_count=1, bypass_cache=True)

        # Assert
        assert len(items) <= 1

    async def test_returns_empty_for_zero_limit(self, db: asyncpg.Connection) -> None:
        """Internal function returns empty list for limit_count=0."""
        # Act
        items = await search_flags_internal(db, limit_count=0, bypass_cache=True)

        # Assert
        assert items == []
