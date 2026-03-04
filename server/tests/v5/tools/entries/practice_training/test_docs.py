"""Tests for get_practice_training_docs."""

import pytest

from app.routes.v5.tools.entries.practice_training.docs import get_practice_training_docs

pytestmark = pytest.mark.asyncio


async def test_returns_docs_response(conn):
    result = await get_practice_training_docs(conn)

    assert result.name == "practice_training"
    assert result.type == "entry"
    assert len(result.description) > 0


async def test_includes_materialized_view(conn):
    result = await get_practice_training_docs(conn)

    assert result.materialized_view is not None
    assert result.materialized_view.name == "practice_training_mv"
    assert len(result.materialized_view.definition) > 0
    assert len(result.materialized_view.columns) > 0


async def test_includes_source_tables(conn):
    result = await get_practice_training_docs(conn)

    table_names = [t.name for t in result.tables]
    assert "practice_training_entry" in table_names


async def test_includes_all_operations(conn):
    result = await get_practice_training_docs(conn)

    op_names = [op.name for op in result.operations]
    assert "refresh_practice_training" in op_names
    assert "get_practice_training_entries_internal" in op_names
    assert "search_practice_training_entries_internal" in op_names


async def test_operations_have_return_types(conn):
    result = await get_practice_training_docs(conn)

    get_op = next(op for op in result.operations if op.name == "get_practice_training_entries_internal")
    assert get_op.returns is not None
