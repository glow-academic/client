"""Tests for get_training_department_docs."""

import pytest

from app.routes.v5.tools.entries.training_department.docs import get_training_department_docs

pytestmark = pytest.mark.asyncio


async def test_returns_docs_response(conn):
    result = await get_training_department_docs(conn)

    assert result.name == "training_department"
    assert result.type == "entry"
    assert len(result.description) > 0


async def test_materialized_view_is_none(conn):
    result = await get_training_department_docs(conn)

    assert result.materialized_view is None


async def test_includes_source_tables(conn):
    result = await get_training_department_docs(conn)

    table_names = [t.name for t in result.tables]
    assert "chat_entry" in table_names


async def test_includes_all_operations(conn):
    result = await get_training_department_docs(conn)

    op_names = [op.name for op in result.operations]
    assert "refresh_training_department" in op_names
    assert "get_training_department_entries_internal" in op_names
    assert "search_training_department_entries_internal" in op_names


async def test_operations_have_return_types(conn):
    result = await get_training_department_docs(conn)

    get_op = next(op for op in result.operations if op.name == "get_training_department_entries_internal")
    assert get_op.returns is not None
