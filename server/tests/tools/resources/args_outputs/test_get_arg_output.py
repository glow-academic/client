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
