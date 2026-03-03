"""Integration tests for resource departments get endpoint."""

import asyncpg
import httpx
import pytest

from app.v5.api.resources.departments.get import get_departments_internal
from app.v5.api.resources.departments.search import search_departments_internal

pytestmark = pytest.mark.asyncio

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}
ZEROED_UUID = "00000000-0000-0000-0000-000000000000"


class TestGetDepartments:
    """Tests for GET /api/v5/resources/departments/get endpoint."""

    async def test_get_departments_returns_items(
        self, client: httpx.AsyncClient, db: asyncpg.Connection
    ) -> None:
        """GET with valid seed IDs returns items."""
        # Arrange — use internal search to find seed IDs
        # (HTTP search has pre-existing positional args bug)
        search_items = await search_departments_internal(db, bypass_cache=True)
        assert len(search_items) > 0
        seed_ids = [str(item.department_id) for item in search_items[:2]]

        # Act
        response = await client.post(
            "/api/v5/resources/departments/get",
            json={"ids": seed_ids},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        returned_ids = {item["department_id"] for item in data["items"]}
        assert returned_ids == set(seed_ids)

    async def test_get_departments_empty_ids(self, client: httpx.AsyncClient) -> None:
        """GET with empty ids returns empty items."""
        # Act
        response = await client.post(
            "/api/v5/resources/departments/get",
            json={"ids": []},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        assert response.json()["items"] == []

    async def test_get_departments_nonexistent_id(
        self, client: httpx.AsyncClient
    ) -> None:
        """GET with nonexistent UUID returns empty items."""
        # Act
        response = await client.post(
            "/api/v5/resources/departments/get",
            json={"ids": [ZEROED_UUID]},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        assert response.json()["items"] == []


class TestGetDepartmentsInternal:
    """Tests for get_departments_internal function."""

    async def test_returns_items_for_valid_ids(self, db: asyncpg.Connection) -> None:
        """Internal function returns items for valid seed IDs."""
        # Arrange — search to find department resource IDs
        search_items = await search_departments_internal(db, bypass_cache=True)
        assert len(search_items) > 0
        seed_ids = [item.department_id for item in search_items[:2]]

        # Act
        items = await get_departments_internal(db, seed_ids, bypass_cache=True)

        # Assert
        assert len(items) == len(seed_ids)
        returned_ids = {item.department_id for item in items}
        assert returned_ids == set(seed_ids)

    async def test_returns_empty_for_empty_ids(self, db: asyncpg.Connection) -> None:
        """Internal function returns empty list for empty IDs."""
        # Act
        items = await get_departments_internal(db, [], bypass_cache=True)

        # Assert
        assert items == []
