"""Tests for get_args."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.args.get import get_args
from tests.seed_ids import SEED_ARG_ID

pytestmark = pytest.mark.asyncio


async def test_get_args_returns_seed(conn):
    items = await get_args(conn, [SEED_ARG_ID])

    assert len(items) == 1
    assert items[0].id == SEED_ARG_ID
    assert items[0].name is not None
    assert items[0].active is True


async def test_get_args_returns_empty_for_missing(conn):
    items = await get_args(conn, [uuid4()])

    assert items == []


async def test_get_args_returns_empty_for_empty_ids(conn):
    items = await get_args(conn, [])

    assert items == []


async def test_cache_hit_skips_db(conn):
    cached_items = [{"id": str(SEED_ARG_ID), "name": "cached_arg", "description": "", "field_type": "text", "required": False, "default_value": "", "created_at": "2024-01-01T00:00:00Z", "active": True, "mcp": False, "generated": False}]

    async def mock_get(key):
        return {"items": cached_items}

    async def mock_set(key, data, ttl, tags):
        pass

    items = await get_args(conn, [SEED_ARG_ID], cache=(mock_get, mock_set))

    assert len(items) == 1
    assert items[0].name == "cached_arg"


async def test_cache_miss_calls_set(conn):
    stored = {}

    async def mock_get(key):
        return None

    async def mock_set(key, data, ttl, tags):
        stored["data"] = data
        stored["ttl"] = ttl
        stored["tags"] = list(tags)

    items = await get_args(conn, [SEED_ARG_ID], cache=(mock_get, mock_set))

    assert len(items) == 1
    assert items[0].id == SEED_ARG_ID
    assert stored["ttl"] == 60
    assert stored["tags"] == ["resources", "args"]
    assert len(stored["data"]["items"]) == 1
