"""Integration tests for resource names get endpoint."""

import asyncpg
import httpx
import pytest

from app.api.v4.resources.names.get import get_names_internal
from app.api.v4.resources.names.search import search_names_internal

pytestmark = pytest.mark.asyncio

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
ZEROED_UUID = "00000000-0000-0000-0000-000000000000"


class TestGetNames:
    """Tests for GET /api/v4/resources/names/get endpoint."""

    async def test_get_names_returns_items(self, client: httpx.AsyncClient) -> None:
        """GET with valid seed IDs returns items."""
        # Arrange
        search_response = await client.post(
            "/api/v4/resources/names/search",
            json={"limit_count": 2},
            headers=BYPASS_CACHE_HEADERS,
        )
        assert search_response.status_code == 200
        seed_ids = [item["id"] for item in search_response.json()["items"]]
        assert len(seed_ids) > 0

        # Act
        response = await client.post(
            "/api/v4/resources/names/get",
            json={"ids": seed_ids},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        returned_ids = {item["id"] for item in data["items"]}
        assert returned_ids == set(seed_ids)

    async def test_get_names_empty_ids(self, client: httpx.AsyncClient) -> None:
        """GET with empty ids returns empty items."""
        # Act
        response = await client.post(
            "/api/v4/resources/names/get",
            json={"ids": []},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        assert response.json()["items"] == []

    async def test_get_names_nonexistent_id(self, client: httpx.AsyncClient) -> None:
        """GET with nonexistent UUID returns empty items."""
        # Act
        response = await client.post(
            "/api/v4/resources/names/get",
            json={"ids": [ZEROED_UUID]},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        assert response.json()["items"] == []


class TestGetNamesInternal:
    """Tests for get_names_internal function."""

    async def test_returns_items_for_valid_ids(self, db: asyncpg.Connection) -> None:
        """Internal function returns items for valid seed IDs."""
        # Arrange
        search_items = await search_names_internal(db, bypass_cache=True)
        assert len(search_items) > 0
        seed_ids = [item.id for item in search_items[:2]]

        # Act
        items = await get_names_internal(db, seed_ids, bypass_cache=True)

        # Assert
        assert len(items) == len(seed_ids)
        returned_ids = {item.id for item in items}
        assert returned_ids == set(seed_ids)

    async def test_returns_empty_for_empty_ids(self, db: asyncpg.Connection) -> None:
        """Internal function returns empty list for empty IDs."""
        # Act
        items = await get_names_internal(db, [], bypass_cache=True)

        # Assert
        assert items == []
