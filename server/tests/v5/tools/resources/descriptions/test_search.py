"""Tests for search_descriptions."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.descriptions.create import create_description
from app.routes.v5.tools.resources.descriptions.search import search_descriptions

pytestmark = pytest.mark.asyncio


async def test_finds_created_description(conn, redis_client):
    await create_description(conn, "search-test-alpha", redis_client)

    items = await search_descriptions(conn, redis_client, search="search-test-alpha")

    assert len(items) >= 1
    assert any(i.description == "search-test-alpha" for i in items)


async def test_search_is_case_insensitive(conn, redis_client):
    await create_description(conn, "CaseTest-Search-Desc", redis_client)

    items = await search_descriptions(conn, redis_client, search="casetest-search-desc")

    assert any(i.description == "CaseTest-Search-Desc" for i in items)


async def test_returns_empty_for_no_match(conn, redis_client):
    items = await search_descriptions(conn, redis_client, search="zzz-no-match-zzz-" + uuid4().hex[:8])

    assert items == []


async def test_respects_limit(conn, redis_client):
    for i in range(5):
        await create_description(conn, f"limit-test-desc-{uuid4().hex[:6]}", redis_client)

    items = await search_descriptions(conn, redis_client, search="limit-test-desc-", limit_count=2)

    assert len(items) <= 2


async def test_respects_offset(conn, redis_client):
    for i in range(3):
        await create_description(conn, f"offset-test-desc-{uuid4().hex[:6]}", redis_client)

    all_items = await search_descriptions(conn, redis_client, search="offset-test-desc-", limit_count=10)
    offset_items = await search_descriptions(conn, redis_client, search="offset-test-desc-", limit_count=10, offset_count=1)

    assert len(offset_items) == len(all_items) - 1


async def test_excludes_ids(conn, redis_client):
    a = await create_description(conn, f"exclude-a-desc-{uuid4().hex[:6]}", redis_client)
    b = await create_description(conn, f"exclude-b-desc-{uuid4().hex[:6]}", redis_client)

    items = await search_descriptions(
        conn, redis_client, search="exclude-", exclude_ids=[a.id],
    )

    ids = [i.id for i in items]
    assert a.id not in ids
    assert b.id in ids


async def test_returns_empty_for_zero_limit(conn, redis_client):
    items = await search_descriptions(conn, redis_client, limit_count=0)

    assert items == []


async def test_cache_hit(conn, redis_client):
    await create_description(conn, f"cache-hit-desc-{uuid4().hex[:6]}", redis_client)

    items1 = await search_descriptions(conn, redis_client, search="cache-hit-desc-")
    items2 = await search_descriptions(conn, redis_client, search="cache-hit-desc-")

    assert len(items1) >= 1
    assert len(items1) == len(items2)


async def test_bypass_cache(conn, redis_client):
    await create_description(conn, f"bypass-desc-{uuid4().hex[:6]}", redis_client)

    items = await search_descriptions(conn, redis_client, search="bypass-desc-", bypass_cache=True)

    assert len(items) >= 1
