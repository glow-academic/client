"""Tests for get_test_benchmark_docs."""

import pytest

from app.routes.v5.tools.entries.test_benchmark.docs import get_test_benchmark_docs

pytestmark = pytest.mark.asyncio


async def test_returns_docs_response(conn):
    result = await get_test_benchmark_docs(conn)

    assert result.name == "test_benchmark"
    assert result.type == "entry"
    assert len(result.description) > 0


async def test_includes_materialized_view(conn):
    result = await get_test_benchmark_docs(conn)

    assert result.materialized_view is not None
    assert result.materialized_view.name == "test_benchmark_mv"
    assert len(result.materialized_view.definition) > 0
    assert len(result.materialized_view.columns) > 0


async def test_includes_source_tables(conn):
    result = await get_test_benchmark_docs(conn)

    table_names = [t.name for t in result.tables]
    assert "test_benchmark_entry" in table_names


async def test_includes_all_operations(conn):
    result = await get_test_benchmark_docs(conn)

    op_names = [op.name for op in result.operations]
    assert "create_test_benchmark" in op_names
    assert "refresh_test_benchmark" in op_names


async def test_create_operation_has_params(conn):
    result = await get_test_benchmark_docs(conn)

    create_op = next(op for op in result.operations if op.name == "create_test_benchmark")
    param_names = [p.name for p in create_op.params]
    assert "test_id" in param_names
    assert "benchmark_id" in param_names
    assert "session_id" in param_names
    assert "mcp" in param_names
