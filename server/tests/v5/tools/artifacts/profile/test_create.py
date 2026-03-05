"""Tests for create_profile — black-box using resource + artifact tools only."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.artifacts.profile.create import create_profile
from app.routes.v5.tools.artifacts.profile.get import get_profiles
from app.routes.v5.tools.resources.departments.create import create_department
from app.routes.v5.tools.resources.flags.create import create_flag
from app.routes.v5.tools.resources.names.create import create_name

pytestmark = pytest.mark.asyncio


def _u() -> str:
    return uuid4().hex[:8]


async def test_creates_bare_artifact(conn, redis_client):
    result = await create_profile(conn)
    assert result.id is not None

    items = await get_profiles(conn, [result.id])
    assert len(items) == 1
    assert items[0].generated is False
    assert items[0].mcp is False


async def test_passes_mcp_flag(conn, redis_client):
    result = await create_profile(conn, mcp=True)

    items = await get_profiles(conn, [result.id])
    assert items[0].mcp is True


async def test_links_single_select_junctions(conn, redis_client):
    name = await create_name(conn, f"n-{_u()}", redis_client)

    result = await create_profile(conn, name_id=name.id)

    items = await get_profiles(conn, [result.id], names=True)
    p = items[0]
    assert p.name_ids == [name.id]


async def test_links_multi_select_junctions(conn, redis_client):
    d1 = await create_department(conn, redis=redis_client)
    d2 = await create_department(conn, redis=redis_client)

    result = await create_profile(conn, department_ids=[d1.id, d2.id])

    items = await get_profiles(conn, [result.id], departments=True)
    assert set(items[0].department_ids) == {d1.id, d2.id}


async def test_links_flags_with_value(conn, redis_client):
    f1 = await create_flag(conn, f"f-{_u()}", "desc", "icon", redis_client)
    f2 = await create_flag(conn, f"f-{_u()}", "desc", "icon", redis_client)

    result = await create_profile(conn, flag_ids=[f1.id, f2.id])

    items = await get_profiles(conn, [result.id], flags=True)
    assert set(items[0].flag_ids) == {f1.id, f2.id}


async def test_no_junctions_when_none_provided(conn, redis_client):
    result = await create_profile(conn)

    items = await get_profiles(
        conn,
        [result.id],
        names=True, departments=True, flags=True,
        emails=True, profiles=True, request_limits=True, roles=True,
    )
    p = items[0]
    assert p.name_ids == []
    assert p.department_ids == []
    assert p.flag_ids == []
    assert p.email_ids == []
    assert p.profile_ids == []
    assert p.request_limit_ids == []
    assert p.role_ids == []
