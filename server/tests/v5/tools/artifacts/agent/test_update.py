"""Tests for update_agent."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.artifacts.agent.create import create_agent
from app.routes.v5.tools.artifacts.agent.get import get_agents
from app.routes.v5.tools.artifacts.agent.update import update_agent

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _name(conn):
    return await conn.fetchval(
        "INSERT INTO names_resource (name) VALUES ($1) RETURNING id",
        f"n-{uuid4().hex[:8]}",
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
    """Create an agent with single + multi junctions for update tests."""
    n = await _name(conn)
    d1 = await _dept(conn)
    d2 = await _dept(conn)

    result = await create_agent(conn, name_id=n, department_ids=[d1, d2])
    return result.id, n, d1, d2


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_updates_base_columns(conn):
    result = await create_agent(conn)
    await update_agent(conn, result.id, active=False, mcp=True)

    row = await conn.fetchrow(
        "SELECT active, mcp FROM agent_artifact WHERE id = $1", result.id
    )
    assert row["active"] is False
    assert row["mcp"] is True


async def test_replaces_single_select_junction(conn):
    aid, old_name, _, _ = await _create_with_junctions(conn)
    new_name = await _name(conn)

    await update_agent(conn, aid, name_id=new_name)

    items = await get_agents(conn, [aid], names=True)
    assert items[0].name_ids == [new_name]

    old_active = await conn.fetchval(
        "SELECT active FROM agent_names_junction "
        "WHERE agent_id = $1 AND name_id = $2",
        aid, old_name,
    )
    assert old_active is False


async def test_skips_junction_when_unset(conn):
    aid, name_id, _, _ = await _create_with_junctions(conn)

    # Update with no junction args — name should be untouched
    await update_agent(conn, aid)

    items = await get_agents(conn, [aid], names=True)
    assert items[0].name_ids == [name_id]


async def test_deactivates_removed_multi_ids(conn):
    aid, _, d1, d2 = await _create_with_junctions(conn)

    await update_agent(conn, aid, department_ids=[d1])

    items = await get_agents(conn, [aid], departments=True)
    assert items[0].department_ids == [d1]

    d2_active = await conn.fetchval(
        "SELECT active FROM agent_departments_junction "
        "WHERE agent_id = $1 AND department_id = $2",
        aid, d2,
    )
    assert d2_active is False


async def test_adds_new_multi_ids(conn):
    aid, _, d1, d2 = await _create_with_junctions(conn)
    d3 = await _dept(conn)

    await update_agent(conn, aid, department_ids=[d1, d2, d3])

    items = await get_agents(conn, [aid], departments=True)
    assert set(items[0].department_ids) == {d1, d2, d3}


async def test_clears_all_multi_ids(conn):
    aid, _, d1, d2 = await _create_with_junctions(conn)

    await update_agent(conn, aid, department_ids=[])

    items = await get_agents(conn, [aid], departments=True)
    assert items[0].department_ids == []


async def test_updates_flag_values(conn):
    f1 = await _flag(conn)
    result = await create_agent(conn, flag_ids={f1: True})

    await update_agent(conn, result.id, flag_ids={f1: False})

    val = await conn.fetchval(
        "SELECT value FROM agent_flags_junction "
        "WHERE agent_id = $1 AND flag_id = $2 AND active = true",
        result.id, f1,
    )
    assert val is False


async def test_multi_none_means_no_change(conn):
    aid, _, d1, d2 = await _create_with_junctions(conn)

    await update_agent(conn, aid, department_ids=None)

    items = await get_agents(conn, [aid], departments=True)
    assert set(items[0].department_ids) == {d1, d2}
