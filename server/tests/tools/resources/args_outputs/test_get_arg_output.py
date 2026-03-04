"""Tests for get_args_outputs."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from tests.seed_ids import SEED_ARG_ID, SEED_ARG_OUTPUT_ID

pytestmark = pytest.mark.asyncio


async def test_get_args_outputs_returns_seed(conn):
    items = await get_args_outputs(conn, [SEED_ARG_OUTPUT_ID])

    assert len(items) == 1
    assert items[0].id == SEED_ARG_OUTPUT_ID
    assert items[0].args_id == SEED_ARG_ID
    assert items[0].name is not None
    assert items[0].active is True


async def test_get_args_outputs_returns_empty_for_missing(conn):
    items = await get_args_outputs(conn, [uuid4()])

    assert items == []


async def test_get_args_outputs_returns_empty_for_empty_ids(conn):
    items = await get_args_outputs(conn, [])

    assert items == []


async def test_cache_hit_skips_db(conn):
    cached_items = [{"id": str(SEED_ARG_OUTPUT_ID), "args_id": str(SEED_ARG_ID), "name": "cached_output", "template": "", "created_at": "2024-01-01T00:00:00Z", "active": True, "mcp": False, "generated": False}]

    async def mock_get(key):
        return {"items": cached_items}

    async def mock_set(key, data, ttl, tags):
        pass

    items = await get_args_outputs(conn, [SEED_ARG_OUTPUT_ID], cache=(mock_get, mock_set))

    assert len(items) == 1
    assert items[0].name == "cached_output"


async def test_cache_miss_calls_set(conn):
    stored = {}

    async def mock_get(key):
        return None

    async def mock_set(key, data, ttl, tags):
        stored["data"] = data
        stored["ttl"] = ttl
        stored["tags"] = list(tags)

    items = await get_args_outputs(conn, [SEED_ARG_OUTPUT_ID], cache=(mock_get, mock_set))

    assert len(items) == 1
    assert items[0].id == SEED_ARG_OUTPUT_ID
    assert stored["ttl"] == 60
    assert stored["tags"] == ["resources", "args_outputs"]
    assert len(stored["data"]["items"]) == 1
