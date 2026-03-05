"""Tests for search_uploads."""

import pytest

from app.routes.v5.tools.resources.uploads.search import search_uploads

pytestmark = pytest.mark.asyncio


async def _create_upload(conn):
    """Create a file resource directly via SQL INSERT."""
    return await conn.fetchval(
        "INSERT INTO files_resource (active, mcp, generated) VALUES (true, false, false) RETURNING id"
    )


async def test_finds_created_upload(conn, redis_client):
    upload_id = await _create_upload(conn)

    items = await search_uploads(conn, redis_client)

    assert len(items) >= 1
    assert any(i.id == upload_id for i in items)


async def test_respects_limit(conn, redis_client):
    for _ in range(5):
        await _create_upload(conn)

    items = await search_uploads(conn, redis_client, limit_count=2)

    assert len(items) <= 2


async def test_respects_offset(conn, redis_client):
    for _ in range(3):
        await _create_upload(conn)

    all_items = await search_uploads(conn, redis_client, limit_count=10)
    offset_items = await search_uploads(
        conn, redis_client, limit_count=10, offset_count=1
    )

    assert len(offset_items) == len(all_items) - 1


async def test_excludes_ids(conn, redis_client):
    a_id = await _create_upload(conn)
    b_id = await _create_upload(conn)

    items = await search_uploads(conn, redis_client, exclude_ids=[a_id])

    ids = [i.id for i in items]
    assert a_id not in ids
    assert b_id in ids


async def test_returns_empty_for_zero_limit(conn, redis_client):
    items = await search_uploads(conn, redis_client, limit_count=0)

    assert items == []


async def test_cache_hit(conn, redis_client):
    await _create_upload(conn)

    items1 = await search_uploads(conn, redis_client)
    items2 = await search_uploads(conn, redis_client)

    assert len(items1) >= 1
    assert len(items1) == len(items2)


async def test_bypass_cache(conn, redis_client):
    await _create_upload(conn)

    items = await search_uploads(conn, redis_client, bypass_cache=True)

    assert len(items) >= 1
