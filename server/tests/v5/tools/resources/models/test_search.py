"""Tests for search_models."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.models.create import create_model
from app.routes.v5.tools.resources.models.search import search_models

pytestmark = pytest.mark.asyncio


async def test_finds_created_model(conn, redis_client):
    await create_model(conn, value="gpt-test", name="search-test-alpha", redis=redis_client)

    items = await search_models(conn, redis_client, search="search-test-alpha")

    assert len(items) >= 1
    assert any(i.name == "search-test-alpha" for i in items)


async def test_search_is_case_insensitive(conn, redis_client):
    await create_model(conn, value="gpt-case", name="CaseTest-Model", redis=redis_client)

    items = await search_models(conn, redis_client, search="casetest-model")

    assert any(i.name == "CaseTest-Model" for i in items)


async def test_returns_empty_for_no_match(conn, redis_client):
    items = await search_models(conn, redis_client, search="zzz-no-match-zzz-" + uuid4().hex[:8])

    assert items == []


async def test_respects_limit(conn, redis_client):
    for i in range(5):
        await create_model(conn, value=f"gpt-limit-{uuid4().hex[:6]}", name=f"limit-test-{uuid4().hex[:6]}", redis=redis_client)

    items = await search_models(conn, redis_client, search="limit-test-", limit_count=2)

    assert len(items) <= 2


async def test_respects_offset(conn, redis_client):
    for i in range(3):
        await create_model(conn, value=f"gpt-offset-{uuid4().hex[:6]}", name=f"offset-test-{uuid4().hex[:6]}", redis=redis_client)

    all_items = await search_models(conn, redis_client, search="offset-test-", limit_count=10)
    offset_items = await search_models(conn, redis_client, search="offset-test-", limit_count=10, offset_count=1)

    assert len(offset_items) == len(all_items) - 1


async def test_excludes_ids(conn, redis_client):
    a = await create_model(conn, value="gpt-exc-a", name=f"exclude-a-{uuid4().hex[:6]}", redis=redis_client)
    b = await create_model(conn, value="gpt-exc-b", name=f"exclude-b-{uuid4().hex[:6]}", redis=redis_client)

    items = await search_models(
        conn, redis_client, search="exclude-", exclude_ids=[a.id],
    )

    ids = [i.id for i in items]
    assert a.id not in ids
    assert b.id in ids


async def test_returns_empty_for_zero_limit(conn, redis_client):
    items = await search_models(conn, redis_client, limit_count=0)

    assert items == []


async def test_cache_hit(conn, redis_client):
    await create_model(conn, value="gpt-cache", name=f"cache-hit-{uuid4().hex[:6]}", redis=redis_client)

    items1 = await search_models(conn, redis_client, search="cache-hit-")
    items2 = await search_models(conn, redis_client, search="cache-hit-")

    assert len(items1) >= 1
    assert len(items1) == len(items2)


async def test_bypass_cache(conn, redis_client):
    await create_model(conn, value="gpt-bypass", name=f"bypass-{uuid4().hex[:6]}", redis=redis_client)

    items = await search_models(conn, redis_client, search="bypass-", bypass_cache=True)

    assert len(items) >= 1
