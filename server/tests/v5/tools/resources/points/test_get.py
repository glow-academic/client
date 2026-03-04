"""Tests for points resource get."""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.points.get import get_points


@pytest.mark.asyncio
async def test_gets_created_point(conn, redis_client):
    row_id = await conn.fetchval(
        """
        INSERT INTO points_resource (value)
        VALUES (10)
        RETURNING id
        """
    )
    items = await get_points(conn, [row_id], redis_client)
    assert len(items) == 1
    assert items[0].id == row_id
    assert items[0].value == 10
    assert items[0].active is True


@pytest.mark.asyncio
async def test_returns_empty_for_missing_id(conn, redis_client):
    items = await get_points(conn, [uuid4()], redis_client)
    assert items == []


@pytest.mark.asyncio
async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_points(conn, [], redis_client)
    assert items == []


@pytest.mark.asyncio
async def test_cache_hit(conn, redis_client):
    row_id = await conn.fetchval(
        """
        INSERT INTO points_resource (value)
        VALUES (10)
        RETURNING id
        """
    )
    await get_points(conn, [row_id], redis_client)

    with patch.object(conn, "fetch", new_callable=AsyncMock) as mock_fetch:
        items = await get_points(conn, [row_id], redis_client)
        mock_fetch.assert_not_called()
        assert len(items) == 1


@pytest.mark.asyncio
async def test_bypass_cache(conn, redis_client):
    row_id = await conn.fetchval(
        """
        INSERT INTO points_resource (value)
        VALUES (10)
        RETURNING id
        """
    )
    await get_points(conn, [row_id], redis_client)

    items = await get_points(
        conn, [row_id], redis_client, bypass_cache=True
    )
    assert len(items) == 1
    assert items[0].value == 10
