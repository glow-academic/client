"""Tests for get_documents."""

import pytest

from app.routes.v5.tools.artifacts.document.create import create_document
from app.routes.v5.tools.artifacts.document.get import get_documents
from app.routes.v5.tools.resources.names.create import create_name
from tests.helpers import nonexistent_id, unique_tag

pytestmark = pytest.mark.asyncio


async def test_returns_base_columns(conn, redis_client):
    name = await create_name(conn, f"test-{unique_tag()}", redis_client)
    created = await create_document(conn, name_id=name.id)

    items = await get_documents(conn, [created.id])

    assert len(items) == 1
    p = items[0]
    assert p.id == created.id
    # No junctions requested — all should be None
    assert p.name_ids is None
    assert p.description_ids is None
    assert p.department_ids is None


async def test_returns_empty_for_unknown_id(conn):

    items = await get_documents(conn, [nonexistent_id()])
    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_documents(conn, [])
    assert items == []


async def test_fetches_name_ids_when_requested(conn, redis_client):
    name = await create_name(conn, f"test-{unique_tag()}", redis_client)
    created = await create_document(conn, name_id=name.id)

    items = await get_documents(conn, [created.id], names=True)

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    # Other junctions still None
    assert p.description_ids is None


async def test_fetches_multiple_junctions(conn, redis_client):
    name = await create_name(conn, f"test-{unique_tag()}", redis_client)
    created = await create_document(conn, name_id=name.id)

    items = await get_documents(
        conn,
        [created.id],
        names=True,
        descriptions=True,
        flags=True,
    )

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    assert p.description_ids is not None
    assert p.flag_ids is not None
    # Unrequested junctions stay None
    assert p.department_ids is None
    assert p.files_ids is None


async def test_no_junctions_when_all_false(conn, redis_client):
    name = await create_name(conn, f"test-{unique_tag()}", redis_client)
    created = await create_document(conn, name_id=name.id)

    items = await get_documents(conn, [created.id])

    p = items[0]
    for field in [
        "name_ids", "description_ids", "department_ids", "flag_ids",
        "files_ids", "images_ids", "parameter_field_ids",
        "parameter_ids", "texts_ids", "document_ids",
    ]:
        assert getattr(p, field) is None
