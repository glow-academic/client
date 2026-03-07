"""Tests for search_resources."""

import pytest
from tests.helpers import unique_tag

from app.routes.v5.tools.resources.resources.create import create_resource
from app.routes.v5.tools.resources.resources.search import search_resources

pytestmark = pytest.mark.asyncio


async def test_finds_created_resource(conn, redis_client):
    await create_resource(conn, "names", redis_client)

    items = await search_resources(conn, redis_client, search="names")

    assert len(items) >= 1
    assert any(i.resource == "names" for i in items)


async def test_returns_empty_for_no_match(conn, redis_client):
    items = await search_resources(
        conn, redis_client, search="zzz-no-match-zzz-" + unique_tag()
    )

    assert items == []


async def test_respects_limit(conn, redis_client):
    items = await search_resources(conn, redis_client, limit_count=2)

    assert len(items) <= 2


async def test_excludes_ids(conn, redis_client):
    a = await create_resource(conn, "names", redis_client)

    items = await search_resources(
        conn,
        redis_client,
        exclude_ids=[a.id],
    )

    ids = [i.id for i in items]
    assert a.id not in ids


async def test_returns_empty_for_zero_limit(conn, redis_client):
    items = await search_resources(conn, redis_client, limit_count=0)

    assert items == []


async def test_cache_hit(conn, redis_client):
    await create_resource(conn, "names", redis_client)

    items1 = await search_resources(conn, redis_client, search="names")
    items2 = await search_resources(conn, redis_client, search="names")

    assert len(items1) >= 1
    assert len(items1) == len(items2)


async def test_bypass_cache(conn, redis_client):
    await create_resource(conn, "names", redis_client)

    items = await search_resources(
        conn, redis_client, search="names", bypass_cache=True
    )

    assert len(items) >= 1
