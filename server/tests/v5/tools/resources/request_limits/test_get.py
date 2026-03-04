"""Tests for request_limits resource get."""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.request_limits.get import get_request_limits


@pytest.mark.asyncio
async def test_gets_created_request_limit(conn, redis_client):
    row_id = await conn.fetchval(
        """
        INSERT INTO request_limits_resource (requests_per_day)
        VALUES (100)
        RETURNING id
        """
    )
    items = await get_request_limits(conn, [row_id], redis_client)
    assert len(items) == 1
    assert items[0].id == row_id
    assert items[0].requests_per_day == 100
    assert items[0].active is True


@pytest.mark.asyncio
async def test_returns_empty_for_missing_id(conn, redis_client):
    items = await get_request_limits(conn, [uuid4()], redis_client)
    assert items == []


@pytest.mark.asyncio
async def test_returns_empty_for_empty_ids(conn, redis_client):
    items = await get_request_limits(conn, [], redis_client)
    assert items == []


@pytest.mark.asyncio
async def test_cache_hit(conn, redis_client):
    row_id = await conn.fetchval(
        """
        INSERT INTO request_limits_resource (requests_per_day)
        VALUES (100)
        RETURNING id
        """
    )
    await get_request_limits(conn, [row_id], redis_client)

    with patch.object(conn, "fetch", new_callable=AsyncMock) as mock_fetch:
        items = await get_request_limits(conn, [row_id], redis_client)
        mock_fetch.assert_not_called()
        assert len(items) == 1


@pytest.mark.asyncio
async def test_bypass_cache(conn, redis_client):
    row_id = await conn.fetchval(
        """
        INSERT INTO request_limits_resource (requests_per_day)
        VALUES (100)
        RETURNING id
        """
    )
    await get_request_limits(conn, [row_id], redis_client)

    items = await get_request_limits(
        conn, [row_id], redis_client, bypass_cache=True
    )
    assert len(items) == 1
    assert items[0].requests_per_day == 100
