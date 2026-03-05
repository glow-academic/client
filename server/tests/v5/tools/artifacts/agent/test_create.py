"""Tests for create_agent."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.artifacts.agent.create import create_agent
from app.routes.v5.tools.artifacts.agent.get import get_agents

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers — create resource rows with required NOT NULL columns
# ---------------------------------------------------------------------------


async def _name(conn):
    return await conn.fetchval(
        "INSERT INTO names_resource (name) VALUES ($1) RETURNING id",
        f"n-{uuid4().hex[:8]}",
    )


async def _desc(conn):
    return await conn.fetchval(
        "INSERT INTO descriptions_resource (description) VALUES ($1) RETURNING id",
        f"d-{uuid4().hex[:8]}",
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


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_creates_bare_artifact(conn):
    result = await create_agent(conn)
    assert result.id is not None

    items = await get_agents(conn, [result.id])
    assert len(items) == 1
    assert items[0].generated is False
    assert items[0].mcp is False


async def test_links_single_and_multi(conn):
    nid = await _name(conn)
    d1 = await _dept(conn)
    d2 = await _dept(conn)

    result = await create_agent(conn, name_id=nid, department_ids=[d1, d2])

    items = await get_agents(conn, [result.id], names=True, departments=True)
    p = items[0]
    assert p.name_ids == [nid]
    assert set(p.department_ids) == {d1, d2}


async def test_links_flags_with_value(conn):
    f1 = await _flag(conn)
    f2 = await _flag(conn)

    result = await create_agent(conn, flag_ids={f1: True, f2: False})

    items = await get_agents(conn, [result.id], flags=True)
    assert set(items[0].flag_ids) == {f1, f2}

    rows = await conn.fetch(
        "SELECT flag_id, value FROM agent_flags_junction "
        "WHERE agent_id = $1 AND active = true",
        result.id,
    )
    vals = {r["flag_id"]: r["value"] for r in rows}
    assert vals[f1] is True
    assert vals[f2] is False


async def test_no_junctions_when_none_provided(conn):
    result = await create_agent(conn)

    items = await get_agents(
        conn,
        [result.id],
        names=True, descriptions=True, departments=True,
        flags=True, models=True, reasoning_levels=True,
        temperature_levels=True, tools=True, voices=True, agents=True,
    )
    p = items[0]
    assert p.name_ids == []
    assert p.department_ids == []
    assert p.flag_ids == []
    assert p.agent_ids == []
