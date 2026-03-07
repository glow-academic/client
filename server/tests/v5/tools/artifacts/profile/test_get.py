"""Tests for get_profiles."""

import pytest
from tests.helpers import nonexistent_id, unique_tag

from app.routes.v5.tools.artifacts.profile.create import create_profile
from app.routes.v5.tools.artifacts.profile.get import get_profiles
from app.routes.v5.tools.resources.names.create import create_name

pytestmark = pytest.mark.asyncio


async def test_returns_base_columns(conn, redis_client):
    name = await create_name(conn, f"test-{unique_tag()}", redis_client)
    created = await create_profile(conn, name_id=name.id)

    items = await get_profiles(conn, [created.id])

    assert len(items) == 1
    p = items[0]
    assert p.id == created.id
    # No junctions requested — all should be None
    assert p.name_ids is None
    assert p.department_ids is None
    assert p.flag_ids is None


async def test_returns_empty_for_unknown_id(conn):

    items = await get_profiles(conn, [nonexistent_id()])
    assert items == []


async def test_returns_empty_for_empty_ids(conn):
    items = await get_profiles(conn, [])
    assert items == []


async def test_fetches_name_ids_when_requested(conn, redis_client):
    name = await create_name(conn, f"test-{unique_tag()}", redis_client)
    created = await create_profile(conn, name_id=name.id)

    items = await get_profiles(conn, [created.id], names=True)

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    # Other junctions still None
    assert p.department_ids is None


async def test_fetches_multiple_junctions(conn, redis_client):
    name = await create_name(conn, f"test-{unique_tag()}", redis_client)
    created = await create_profile(conn, name_id=name.id)

    items = await get_profiles(
        conn,
        [created.id],
        names=True,
        departments=True,
        roles=True,
    )

    assert len(items) == 1
    p = items[0]
    assert p.name_ids is not None
    assert p.department_ids is not None
    assert p.role_ids is not None
    # Unrequested junctions stay None
    assert p.flag_ids is None
    assert p.email_ids is None


async def test_no_junctions_when_all_false(conn, redis_client):
    name = await create_name(conn, f"test-{unique_tag()}", redis_client)
    created = await create_profile(conn, name_id=name.id)

    items = await get_profiles(conn, [created.id])

    p = items[0]
    for field in [
        "name_ids",
        "department_ids",
        "flag_ids",
        "email_ids",
        "profile_ids",
        "request_limit_ids",
        "role_ids",
    ]:
        assert getattr(p, field) is None
