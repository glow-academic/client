"""Tests for search_operations."""


import pytest

from app.routes.v5.tools.resources.operations.create import create_operation
from app.routes.v5.tools.resources.operations.search import search_operations
from tests.helpers import unique_tag

pytestmark = pytest.mark.asyncio


async def test_finds_created_operation(conn, redis_client):
    tag = unique_tag()
    await create_operation(conn, f"search-op-{tag}", redis_client)

    items = await search_operations(conn, redis_client, search=f"search-op-{tag}")

    assert len(items) >= 1


async def test_search_is_case_insensitive(conn, redis_client):
    tag = unique_tag()
    await create_operation(conn, f"CaseOp-{tag}", redis_client)

    items = await search_operations(conn, redis_client, search=f"caseop-{tag}")

    assert len(items) >= 1


async def test_returns_empty_for_no_match(conn, redis_client):
    items = await search_operations(
        conn, redis_client, search="zzz-no-match-zzz-" + unique_tag()
    )

    assert items == []


async def test_respects_limit(conn, redis_client):
    for i in range(5):
        await create_operation(conn, f"limit-op-{unique_tag()}", redis_client)

    items = await search_operations(conn, redis_client, search="limit-op-", limit_count=2)

    assert len(items) <= 2


async def test_respects_offset(conn, redis_client):
    tag = unique_tag()
    for i in range(3):
        await create_operation(conn, f"offset-op-{tag}-{i}", redis_client)

    all_items = await search_operations(conn, redis_client, search=f"offset-op-{tag}", limit_count=10)
    offset_items = await search_operations(
        conn, redis_client, search=f"offset-op-{tag}", limit_count=10, offset_count=1
    )

    assert len(offset_items) == len(all_items) - 1


async def test_excludes_ids(conn, redis_client):
    tag = unique_tag()
    a = await create_operation(conn, f"exclude-a-{tag}", redis_client)
    b = await create_operation(conn, f"exclude-b-{tag}", redis_client)

    items = await search_operations(
        conn, redis_client, search="exclude-", exclude_ids=[a.id],
    )

    ids = [i.id for i in items]
    assert a.id not in ids
    assert b.id in ids


async def test_returns_empty_for_zero_limit(conn, redis_client):
    items = await search_operations(conn, redis_client, limit_count=0)

    assert items == []


async def test_bypass_cache(conn, redis_client):
    tag = unique_tag()
    await create_operation(conn, f"bypass-op-{tag}", redis_client)

    items = await search_operations(conn, redis_client, search=f"bypass-op-{tag}", bypass_cache=True)

    assert len(items) >= 1
