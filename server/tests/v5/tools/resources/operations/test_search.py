"""Tests for search_operations."""

import pytest

from app.routes.v5.tools.resources.operations.create import create_operation
from app.routes.v5.tools.resources.operations.search import search_operations

pytestmark = pytest.mark.asyncio


async def test_finds_created_operation(conn, redis_client):
    await create_operation(conn, "search", redis_client)

    items = await search_operations(conn, redis_client, search="search")

    assert any(item.operation == "search" for item in items)


async def test_search_is_case_insensitive(conn, redis_client):
    await create_operation(conn, "create", redis_client)

    items = await search_operations(conn, redis_client, search="CREATE")

    assert any(item.operation == "create" for item in items)


async def test_returns_empty_for_no_match(conn, redis_client):
    items = await search_operations(conn, redis_client, search="zzz-no-match-zzz")

    assert items == []


async def test_respects_limit(conn, redis_client):
    items = await search_operations(conn, redis_client, limit_count=2)

    assert len(items) == 2


async def test_respects_offset(conn, redis_client):
    all_items = await search_operations(conn, redis_client, limit_count=10)
    offset_items = await search_operations(conn, redis_client, limit_count=10, offset_count=1)

    assert len(offset_items) == len(all_items)
    assert offset_items[0].id != all_items[0].id
    assert offset_items[0].id == all_items[1].id


async def test_excludes_ids(conn, redis_client):
    a = await create_operation(conn, "delete", redis_client)
    b = await create_operation(conn, "duplicate", redis_client)

    items = await search_operations(
        conn,
        redis_client,
        limit_count=100,
        exclude_ids=[a.id],
    )

    ids = [i.id for i in items]
    assert a.id not in ids
    assert b.id in ids


async def test_returns_empty_for_zero_limit(conn, redis_client):
    items = await search_operations(conn, redis_client, limit_count=0)

    assert items == []


async def test_bypass_cache(conn, redis_client):
    await create_operation(conn, "draft", redis_client)

    items = await search_operations(conn, redis_client, search="draft", bypass_cache=True)

    assert any(item.operation == "draft" for item in items)
