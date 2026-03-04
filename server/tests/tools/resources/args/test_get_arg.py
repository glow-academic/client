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
