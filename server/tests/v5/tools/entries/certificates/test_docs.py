"""Tests for get_certificates_docs."""

import pytest

from app.routes.v5.tools.entries.certificates.docs import get_certificates_docs

pytestmark = pytest.mark.asyncio


async def test_returns_docs_response(conn):
    result = await get_certificates_docs(conn)

    assert result.name == "certificates"
    assert result.type == "entry"
    assert len(result.description) > 0


async def test_no_materialized_view(conn):
    result = await get_certificates_docs(conn)

    assert result.materialized_view is None


async def test_includes_source_tables(conn):
    result = await get_certificates_docs(conn)

    table_names = [t.name for t in result.tables]
    assert "certificates_entry" in table_names


async def test_includes_all_operations(conn):
    result = await get_certificates_docs(conn)

    op_names = [op.name for op in result.operations]
    assert "create_certificates_entry_internal" in op_names
    assert "search_certificates_entries_internal" in op_names


async def test_create_operation_has_params(conn):
    result = await get_certificates_docs(conn)

    create_op = next(op for op in result.operations if op.name == "create_certificates_entry_internal")
    param_names = [p.name for p in create_op.params]
    assert "request_dict" in param_names
    assert "mcp" in param_names
