"""Tests for get_reports_docs."""

import pytest

from app.routes.v5.tools.entries.reports.docs import get_reports_docs

pytestmark = pytest.mark.asyncio


async def test_returns_docs_response(conn):
    result = await get_reports_docs(conn)

    assert result.name == "reports"
    assert result.type == "entry"
    assert len(result.description) > 0


async def test_materialized_view_is_none(conn):
    result = await get_reports_docs(conn)

    assert result.materialized_view is None


async def test_includes_source_tables(conn):
    result = await get_reports_docs(conn)

    table_names = [t.name for t in result.tables]
    assert "reports_entry" in table_names


async def test_includes_all_operations(conn):
    result = await get_reports_docs(conn)

    op_names = [op.name for op in result.operations]
    assert "create_reports_entry_internal" in op_names
    assert "get_reports_entries_internal" in op_names
    assert "search_reports_entries_internal" in op_names


async def test_create_operation_has_params(conn):
    result = await get_reports_docs(conn)

    create_op = next(op for op in result.operations if op.name == "create_reports_entry_internal")
    param_names = [p.name for p in create_op.params]
    assert "conn" in param_names
    assert "request_dict" in param_names
    assert "mcp" in param_names
