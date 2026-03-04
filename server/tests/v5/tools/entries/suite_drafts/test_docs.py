"""Tests for get_suite_drafts_docs."""

import pytest

from app.routes.v5.tools.entries.suite_drafts.docs import get_suite_drafts_docs

pytestmark = pytest.mark.asyncio


async def test_returns_docs_response(conn):
    result = await get_suite_drafts_docs(conn)

    assert result.name == "suite_drafts"
    assert result.type == "entry"
    assert len(result.description) > 0


async def test_materialized_view_is_none(conn):
    result = await get_suite_drafts_docs(conn)

    assert result.materialized_view is None


async def test_includes_source_tables(conn):
    result = await get_suite_drafts_docs(conn)

    table_names = [t.name for t in result.tables]
    assert "invocation_drafts_entry" in table_names
    assert "invocation_drafts_departments_connection" in table_names
    assert "invocation_drafts_descriptions_connection" in table_names
    assert "invocation_drafts_flags_connection" in table_names
    assert "invocation_drafts_names_connection" in table_names


async def test_includes_all_operations(conn):
    result = await get_suite_drafts_docs(conn)

    op_names = [op.name for op in result.operations]
    assert "refresh_suite_drafts" in op_names
    assert "get_suite_drafts_entries_internal" in op_names
    assert "search_suite_drafts_entries_internal" in op_names


async def test_operations_have_return_types(conn):
    result = await get_suite_drafts_docs(conn)

    get_op = next(op for op in result.operations if op.name == "get_suite_drafts_entries_internal")
    assert get_op.returns is not None
