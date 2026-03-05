"""Tests for search_entries."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.entries.create import create_entry
from app.routes.v5.tools.resources.entries.search import search_entries

pytestmark = pytest.mark.asyncio


async def test_finds_created_entry(conn, redis_client):
    await create_entry(conn, "activity", redis_client)

    items = await search_entries(conn, redis_client, search="activity")

    assert len(items) >= 1
    assert any(i.entry == "activity" for i in items)


async def test_search_is_case_insensitive(conn, redis_client):
    await create_entry(conn, "uploads", redis_client)

    items = await search_entries(conn, redis_client, search="UPLOADS")

    assert any(i.entry == "uploads" for i in items)


async def test_returns_empty_for_no_match(conn, redis_client):
    items = await search_entries(
        conn, redis_client, search="zzz-no-match-zzz-" + uuid4().hex[:8]
    )

    assert items == []


async def test_respects_limit(conn, redis_client):
    await create_entry(conn, "calls", redis_client)
    await create_entry(conn, "config", redis_client)
    await create_entry(conn, "debug_info", redis_client)
    await create_entry(conn, "domains", redis_client)
    await create_entry(conn, "drafts", redis_client)

    items = await search_entries(conn, redis_client, limit_count=2)

    assert len(items) <= 2


async def test_respects_offset(conn, redis_client):
    await create_entry(conn, "grants", redis_client)
    await create_entry(conn, "groups", redis_client)
    await create_entry(conn, "health", redis_client)

    all_items = await search_entries(conn, redis_client, search="gr", limit_count=10)
    offset_items = await search_entries(
        conn, redis_client, search="gr", limit_count=10, offset_count=1
    )

    assert len(offset_items) == len(all_items) - 1


async def test_excludes_ids(conn, redis_client):
    # Both "tests" and "texts" contain "te"
    a = await create_entry(conn, "tests", redis_client)
    b = await create_entry(conn, "texts", redis_client)

    items = await search_entries(
        conn, redis_client, search="te", exclude_ids=[a.id], limit_count=100,
    )

    ids = [i.id for i in items]
    assert a.id not in ids
    assert b.id in ids


async def test_returns_empty_for_zero_limit(conn, redis_client):
    items = await search_entries(conn, redis_client, limit_count=0)

    assert items == []


async def test_cache_hit(conn, redis_client):
    await create_entry(conn, "metrics", redis_client)

    items1 = await search_entries(conn, redis_client, search="metrics")
    items2 = await search_entries(conn, redis_client, search="metrics")

    assert len(items1) >= 1
    assert len(items1) == len(items2)


async def test_bypass_cache(conn, redis_client):
    await create_entry(conn, "runs", redis_client)

    items = await search_entries(conn, redis_client, search="runs", bypass_cache=True)

    assert len(items) >= 1
