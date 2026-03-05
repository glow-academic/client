"""Tests for update_auth."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.artifacts.auth.create import create_auth
from app.routes.v5.tools.artifacts.auth.get import get_auths
from app.routes.v5.tools.artifacts.auth.update import update_auth

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _name(conn):
    return await conn.fetchval(
        "INSERT INTO names_resource (name) VALUES ($1) RETURNING id",
        f"n-{uuid4().hex[:8]}",
    )


async def _slug(conn):
    return await conn.fetchval(
        "INSERT INTO slugs_resource (value) VALUES ($1) RETURNING id",
        f"s-{uuid4().hex[:8]}",
    )


async def _dept(conn):
    return await conn.fetchval(
        "INSERT INTO departments_resource DEFAULT VALUES RETURNING id"
    )


async def _flag(conn):
    return await conn.fetchval(
        "INSERT INTO flags_resource (name, description, icon) VALUES ($1, $2, $3) RETURNING id",
        f"f-{uuid4().hex[:8]}",
        "desc",
        "icon",
    )


async def _create_with_junctions(conn):
    """Create an auth with single + multi junctions for update tests."""
    n = await _name(conn)
    s = await _slug(conn)
    d1 = await _dept(conn)
    d2 = await _dept(conn)

    result = await create_auth(conn, name_id=n, slug_id=s, department_ids=[d1, d2])
    return result.id, n, s, d1, d2


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_updates_base_columns(conn):
    result = await create_auth(conn)
    await update_auth(conn, result.id, active=False, mcp=True)

    row = await conn.fetchrow(
        "SELECT active, mcp FROM auth_artifact WHERE id = $1", result.id
    )
    assert row["active"] is False
    assert row["mcp"] is True


async def test_replaces_single_select_junction(conn):
    aid, old_name, _, _, _ = await _create_with_junctions(conn)
    new_name = await _name(conn)

    await update_auth(conn, aid, name_id=new_name)

    items = await get_auths(conn, [aid], names=True)
    assert items[0].name_ids == [new_name]

    old_active = await conn.fetchval(
        "SELECT active FROM auth_names_junction "
        "WHERE auth_id = $1 AND name_id = $2",
        aid, old_name,
    )
    assert old_active is False


async def test_skips_junction_when_unset(conn):
    aid, name_id, slug_id, _, _ = await _create_with_junctions(conn)

    # Update with no junction args — name and slug should be untouched
    await update_auth(conn, aid)

    items = await get_auths(conn, [aid], names=True, slugs=True)
    assert items[0].name_ids == [name_id]
    assert items[0].slug_ids == [slug_id]


async def test_deactivates_removed_multi_ids(conn):
    aid, _, _, d1, d2 = await _create_with_junctions(conn)

    await update_auth(conn, aid, department_ids=[d1])

    items = await get_auths(conn, [aid], departments=True)
    assert items[0].department_ids == [d1]

    d2_active = await conn.fetchval(
        "SELECT active FROM auth_departments_junction "
        "WHERE auth_id = $1 AND department_id = $2",
        aid, d2,
    )
    assert d2_active is False


async def test_adds_new_multi_ids(conn):
    aid, _, _, d1, d2 = await _create_with_junctions(conn)
    d3 = await _dept(conn)

    await update_auth(conn, aid, department_ids=[d1, d2, d3])

    items = await get_auths(conn, [aid], departments=True)
    assert set(items[0].department_ids) == {d1, d2, d3}


async def test_clears_all_multi_ids(conn):
    aid, _, _, d1, d2 = await _create_with_junctions(conn)

    await update_auth(conn, aid, department_ids=[])

    items = await get_auths(conn, [aid], departments=True)
    assert items[0].department_ids == []


async def test_updates_flag_values(conn):
    f1 = await _flag(conn)
    result = await create_auth(conn, flag_ids={f1: True})

    await update_auth(conn, result.id, flag_ids={f1: False})

    val = await conn.fetchval(
        "SELECT value FROM auth_flags_junction "
        "WHERE auth_id = $1 AND flag_id = $2 AND active = true",
        result.id, f1,
    )
    assert val is False


async def test_multi_none_means_no_change(conn):
    aid, _, _, d1, d2 = await _create_with_junctions(conn)

    await update_auth(conn, aid, department_ids=None)

    items = await get_auths(conn, [aid], departments=True)
    assert set(items[0].department_ids) == {d1, d2}
