"""Integration tests for resource departments search endpoint."""

import pytest

import asyncpg
import httpx

from app.api.v4.resources.departments.search import search_departments_internal
from tests.seed_helpers import TEST_CS_DEPT_ID

pytestmark = pytest.mark.asyncio

BYPASS_CACHE_HEADERS = {"X-Bypass-Cache": "1"}


class TestSearchDepartments:
    """Tests for POST /api/v4/resources/departments/search endpoint."""

    async def test_search_departments_returns_items(
        self, client: httpx.AsyncClient
    ) -> None:
        """SEARCH with no filters returns items."""
        # Act
        response = await client.post(
            "/api/v4/resources/departments/search",
            json={},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) > 0

    async def test_search_departments_with_limit(
        self, client: httpx.AsyncClient
    ) -> None:
        """SEARCH with limit_count=1 returns at most 1 item."""
        # Act
        response = await client.post(
            "/api/v4/resources/departments/search",
            json={"limit_count": 1},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        assert len(response.json()["items"]) <= 1

    async def test_search_departments_with_offset(
        self, client: httpx.AsyncClient
    ) -> None:
        """SEARCH with large offset returns 0 items."""
        # Act
        response = await client.post(
            "/api/v4/resources/departments/search",
            json={"offset_count": 999999},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        assert len(response.json()["items"]) == 0

    async def test_search_departments_with_user_department_ids(
        self, client: httpx.AsyncClient
    ) -> None:
        """SEARCH with user_department_ids filter returns matching departments."""
        # Act
        response = await client.post(
            "/api/v4/resources/departments/search",
            json={"user_department_ids": [TEST_CS_DEPT_ID]},
            headers=BYPASS_CACHE_HEADERS,
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) > 0


class TestSearchDepartmentsInternal:
    """Tests for search_departments_internal function."""

    async def test_returns_items(self, db: asyncpg.Connection) -> None:
        """Internal function returns items with no filters."""
        # Act
        items = await search_departments_internal(db, bypass_cache=True)

        # Assert
        assert len(items) > 0

    async def test_respects_limit(self, db: asyncpg.Connection) -> None:
        """Internal function respects limit_count."""
        # Act
        items = await search_departments_internal(
            db, limit_count=1, bypass_cache=True
        )

        # Assert
        assert len(items) <= 1

    async def test_returns_empty_for_zero_limit(self, db: asyncpg.Connection) -> None:
        """Internal function returns empty list for limit_count=0."""
        # Act
        items = await search_departments_internal(
            db, limit_count=0, bypass_cache=True
        )

        # Assert
        assert items == []
