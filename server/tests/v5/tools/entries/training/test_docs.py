"""Tests for get_training_docs."""

import pytest

from app.routes.v5.tools.entries.training.docs import get_training_docs

pytestmark = pytest.mark.asyncio


async def test_returns_docs_response(conn):
    result = await get_training_docs(conn)

    assert result.name == "training"
    assert result.type == "entry"
    assert len(result.description) > 0


async def test_materialized_view_is_none(conn):
    result = await get_training_docs(conn)

    assert result.materialized_view is None


async def test_includes_source_tables(conn):
    result = await get_training_docs(conn)

    table_names = [t.name for t in result.tables]
    assert "chat_entry" in table_names
    assert "chat_scenarios_connection" in table_names
    assert "chat_departments_connection" in table_names
    assert "chat_descriptions_connection" in table_names
    assert "chat_documents_connection" in table_names


async def test_includes_all_operations(conn):
    result = await get_training_docs(conn)

    op_names = [op.name for op in result.operations]
    assert "refresh_training" in op_names
    assert "get_training_entries_internal" in op_names
    assert "search_training_entries_internal" in op_names


async def test_operations_have_return_types(conn):
    result = await get_training_docs(conn)

    get_op = next(op for op in result.operations if op.name == "get_training_entries_internal")
    assert get_op.returns is not None
