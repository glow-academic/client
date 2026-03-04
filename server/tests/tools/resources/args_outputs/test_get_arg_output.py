"""Tests for get_args_outputs."""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.routes.v5.tools.resources.args_outputs.get import get_args_outputs
from tests.seed_ids import SEED_ARG_ID, SEED_ARG_OUTPUT_ID

pytestmark = pytest.mark.asyncio


async def test_get_args_outputs_returns_seed(conn: object) -> None:
    redis = AsyncMock()
    items = await get_args_outputs(conn, [SEED_ARG_OUTPUT_ID], redis)

    assert len(items) == 1
    assert items[0].id == SEED_ARG_OUTPUT_ID
    assert items[0].args_id == SEED_ARG_ID
    assert items[0].name is not None
    assert items[0].active is True


async def test_get_args_outputs_returns_empty_for_missing(conn: object) -> None:
    redis = AsyncMock()
    items = await get_args_outputs(conn, [uuid4()], redis)

    assert items == []


async def test_get_args_outputs_returns_empty_for_empty_ids(conn: object) -> None:
    redis = AsyncMock()
    items = await get_args_outputs(conn, [], redis)

    assert items == []


async def test_cache_hit_skips_db(conn: object) -> None:
    cached_items = [{"id": str(SEED_ARG_OUTPUT_ID), "args_id": str(SEED_ARG_ID), "name": "cached_output", "template": "", "created_at": "2024-01-01T00:00:00Z", "active": True, "mcp": False, "generated": False}]

    redis = AsyncMock()

    with patch("app.routes.v5.tools.resources.args_outputs.get.get_cached", new_callable=AsyncMock, return_value={"items": cached_items}):
        items = await get_args_outputs(conn, [SEED_ARG_OUTPUT_ID], redis)

    assert len(items) == 1
    assert items[0].name == "cached_output"


async def test_cache_miss_calls_set(conn: object) -> None:
    redis = AsyncMock()

    mock_set = AsyncMock()
    with patch("app.routes.v5.tools.resources.args_outputs.get.get_cached", new_callable=AsyncMock, return_value=None):
        with patch("app.routes.v5.tools.resources.args_outputs.get.set_cached", mock_set):
            items = await get_args_outputs(conn, [SEED_ARG_OUTPUT_ID], redis)

    assert len(items) == 1
    assert items[0].id == SEED_ARG_OUTPUT_ID
    mock_set.assert_called_once()
    call_args = mock_set.call_args
    assert call_args.kwargs["redis"] is redis
    assert call_args.args[2] == 60  # ttl
    assert list(call_args.args[3]) == ["resources", "args_outputs"]  # tags
