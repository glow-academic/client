"""Integration tests for resource keys search endpoint."""

import asyncpg
import httpx
import pytest

from app.api.v4.resources.keys.search import search_keys_internal

pytestmark = pytest.mark.asyncio

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}


class TestSearchKeys:
    """Tests for POST /api/v4/resources/keys/search endpoint."""

    async def test_search_keys_returns_200(self, client: httpx.AsyncClient) -> None:
        """SEARCH with no filters returns 200."""
        # Act
        response = await client.post(
            "/api/v4/resources/keys/search",
            json={},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    async def test_search_keys_with_limit(self, client: httpx.AsyncClient) -> None:
        """SEARCH with limit_count=1 returns at most 1 item."""
        # Act
        response = await client.post(
            "/api/v4/resources/keys/search",
            json={"limit_count": 1},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        assert len(response.json()["items"]) <= 1

    async def test_search_keys_with_offset(self, client: httpx.AsyncClient) -> None:
        """SEARCH with large offset returns 0 items."""
        # Act
        response = await client.post(
            "/api/v4/resources/keys/search",
            json={"offset_count": 999999},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        assert len(response.json()["items"]) == 0


class TestSearchKeysInternal:
    """Tests for search_keys_internal function."""

    async def test_returns_200(self, db: asyncpg.Connection) -> None:
        """Internal function returns without error."""
        # Act
        items = await search_keys_internal(db, bypass_cache=True)

        # Assert
        assert isinstance(items, list)

    async def test_respects_limit(self, db: asyncpg.Connection) -> None:
        """Internal function respects limit_count."""
        # Act
        items = await search_keys_internal(db, limit_count=1, bypass_cache=True)

        # Assert
        assert len(items) <= 1

    async def test_returns_empty_for_zero_limit(self, db: asyncpg.Connection) -> None:
        """Internal function returns empty list for limit_count=0."""
        # Act
        items = await search_keys_internal(db, limit_count=0, bypass_cache=True)

        # Assert
        assert items == []
