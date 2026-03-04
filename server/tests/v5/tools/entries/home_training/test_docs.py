"""Tests for get_home_training_docs."""

import pytest

from app.routes.v5.tools.entries.home_training.docs import get_home_training_docs

pytestmark = pytest.mark.asyncio


async def test_returns_docs_response(conn):
    result = await get_home_training_docs(conn)

    assert result.name == "home_training"
    assert result.type == "entry"
    assert len(result.description) > 0


async def test_includes_materialized_view(conn):
    result = await get_home_training_docs(conn)

    assert result.materialized_view is not None
    assert result.materialized_view.name == "home_training_mv"
    assert len(result.materialized_view.definition) > 0
    assert len(result.materialized_view.columns) > 0


async def test_no_source_tables(conn):
    result = await get_home_training_docs(conn)

    assert len(result.tables) == 0


async def test_includes_all_operations(conn):
    result = await get_home_training_docs(conn)

    op_names = [op.name for op in result.operations]
    assert "refresh_home_training_internal" in op_names
    assert "get_home_training_entries_internal" in op_names


async def test_operations_available(conn):
    result = await get_home_training_docs(conn)

    assert len(result.operations) == 2
