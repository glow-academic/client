"""Tests for get_rubrics."""

import pytest

from app.routes.v5.tools.artifacts.rubric.create import create_rubric
from app.routes.v5.tools.artifacts.rubric.get import get_rubrics
from app.routes.v5.tools.resources.names.create import create_name
from tests.helpers import nonexistent_id, unique_tag

pytestmark = pytest.mark.asyncio


async def test_returns_base_columns(conn, redis_client):
    name = await create_name(conn, f"test-{unique_tag()}", redis_client)
    created = await create_rubric(conn, name_id=name.id)

    items = await get_rubrics(conn, [created.id])

    assert len(items) == 1
    p = items[0]
    assert p.id == created.id
    # No junctions requested — all should be None
    assert p.name_ids is None
    assert p.description_ids is None
    assert p.department_ids is None
    assert p.flag_ids is None
    assert p.point_ids is None
    assert p.standard_group_ids is None
    assert p.standard_ids is None
    assert p.rubric_ids is None


async def test_returns_empty_for_unknown_id(conn):

    items = await get_rubrics(conn, [nonexistent_id()])
    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_rubrics(conn, [])
    assert items == []


async def test_fetches_name_ids_when_requested(conn, redis_client):
    name = await create_name(conn, f"test-{unique_tag()}", redis_client)
    created = await create_rubric(conn, name_id=name.id)

    items = await get_rubrics(conn, [created.id], names=True)

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    # Other junctions still None
    assert p.description_ids is None


async def test_fetches_multiple_junctions(conn, redis_client):
    name = await create_name(conn, f"test-{unique_tag()}", redis_client)
    created = await create_rubric(conn, name_id=name.id)

    items = await get_rubrics(
        conn,
        [created.id],
        names=True,
        descriptions=True,
        departments=True,
    )

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    assert p.description_ids is not None
    assert p.department_ids is not None
    # Unrequested junctions stay None
    assert p.flag_ids is None
    assert p.point_ids is None


async def test_no_junctions_when_all_false(conn, redis_client):
    name = await create_name(conn, f"test-{unique_tag()}", redis_client)
    created = await create_rubric(conn, name_id=name.id)

    items = await get_rubrics(conn, [created.id])

    p = items[0]
    for field in [
        "name_ids",
        "description_ids",
        "department_ids",
        "flag_ids",
        "point_ids",
        "standard_group_ids",
        "standard_ids",
        "rubric_ids",
    ]:
        assert getattr(p, field) is None
