"""Tests for get_debug_info_docs."""

import pytest

from app.routes.v5.tools.entries.debug_info.docs import get_debug_info_docs

pytestmark = pytest.mark.asyncio


async def test_returns_docs(conn):
    result = await get_debug_info_docs(conn)

    assert result.name == "debug_info"
    assert result.type == "entry"
    assert len(result.description) > 0


async def test_includes_mv(conn):
    result = await get_debug_info_docs(conn)

    assert result.materialized_view is not None
    assert result.materialized_view.name == "debug_info_mv"
    assert len(result.materialized_view.definition) > 0
    assert len(result.materialized_view.columns) > 0


async def test_includes_tables(conn):
    result = await get_debug_info_docs(conn)

    table_names = [t.name for t in result.tables]
    assert "debug_info_entry" in table_names


async def test_includes_operations(conn):
    result = await get_debug_info_docs(conn)

    op_names = [op.name for op in result.operations]
    assert "create_debug_info" in op_names
    assert "refresh_debug_info" in op_names
    assert "get_debug_info" in op_names
    assert "search_debug_info" in op_names


async def test_search_has_filters(conn):
    result = await get_debug_info_docs(conn)

    search_op = next(op for op in result.operations if op.name == "search_debug_info")
    param_names = [p.name for p in search_op.params]
    assert "call_ids" in param_names
    assert "run_ids" in param_names
    assert "date_from" in param_names
    assert "date_to" in param_names
    assert "mcp" in param_names
