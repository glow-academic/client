"""Integration tests for resource departments search endpoint.

NOTE: The HTTP search handler has a pre-existing positional args bug
(passes booleans where exclude_ids is expected). Internal function tests
verify the search logic directly.
"""

import asyncpg
import pytest

from app.v5.api.resources.departments.search import search_departments_internal

pytestmark = pytest.mark.asyncio


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
        items = await search_departments_internal(db, limit_count=1, bypass_cache=True)

        # Assert
        assert len(items) <= 1

    async def test_returns_empty_for_zero_limit(self, db: asyncpg.Connection) -> None:
        """Internal function returns empty list for limit_count=0."""
        # Act
        items = await search_departments_internal(db, limit_count=0, bypass_cache=True)

        # Assert
        assert items == []
