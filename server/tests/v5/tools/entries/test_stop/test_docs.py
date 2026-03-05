"""Tests for get_test_stop_docs."""

import pytest

from app.routes.v5.tools.entries.test_stop.docs import get_test_stop_docs

pytestmark = pytest.mark.asyncio


async def test_returns_docs_response(conn):
    result = await get_test_stop_docs(conn)

    assert result.name == "test_stop"
    assert result.type == "entry"
    assert len(result.description) > 0


async def test_includes_materialized_view(conn):
    result = await get_test_stop_docs(conn)

    assert result.materialized_view is not None
    assert result.materialized_view.name == "test_stop_mv"
    assert len(result.materialized_view.definition) > 0
    assert len(result.materialized_view.columns) > 0


async def test_includes_source_tables(conn):
    result = await get_test_stop_docs(conn)

    table_names = [t.name for t in result.tables]
    assert "test_stop_entry" in table_names


async def test_includes_all_operations(conn):
    result = await get_test_stop_docs(conn)

    op_names = [op.name for op in result.operations]
    assert "create_test_stop" in op_names
    assert "refresh_test_stop" in op_names
    assert "get_test_stops" in op_names
    assert "search_test_stop_entries_internal" in op_names


async def test_create_operation_has_params(conn):
    result = await get_test_stop_docs(conn)

    create_op = next(op for op in result.operations if op.name == "create_test_stop")
    param_names = [p.name for p in create_op.params]
    assert "invocation_id" in param_names
    assert "call_id" in param_names
    assert "stopped" in param_names
    assert "mcp" in param_names
