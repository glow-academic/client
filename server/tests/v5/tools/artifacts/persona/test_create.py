"""Tests for create_persona."""

import pytest

from app.routes.v5.tools.artifacts.persona.create import create_persona
from app.routes.v5.tools.artifacts.persona.get import get_personas

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers — create resource rows with required NOT NULL columns
# ---------------------------------------------------------------------------


async def _name(conn):
    from uuid import uuid4

    return await conn.fetchval(
        "INSERT INTO names_resource (name) VALUES ($1) RETURNING id",
        f"n-{uuid4().hex[:8]}",
    )


async def _color(conn):
    from uuid import uuid4

    return await conn.fetchval(
        "INSERT INTO colors_resource (name, description, hex_code) VALUES ($1, $2, $3) RETURNING id",
        f"c-{uuid4().hex[:8]}",
        "desc",
        "#000000",
    )


async def _icon(conn):
    from uuid import uuid4

    return await conn.fetchval(
        "INSERT INTO icons_resource (name, description, value) VALUES ($1, $2, $3) RETURNING id",
        f"i-{uuid4().hex[:8]}",
        "desc",
        "icon-val",
    )


async def _dept(conn):
    return await conn.fetchval(
        "INSERT INTO departments_resource DEFAULT VALUES RETURNING id"
    )


async def _voice(conn):
    from uuid import uuid4

    return await conn.fetchval(
        "INSERT INTO voices_resource (voice) VALUES ($1) RETURNING id",
        f"v-{uuid4().hex[:8]}",
    )


async def _example(conn):
    return await conn.fetchval(
        "INSERT INTO examples_resource (example) VALUES ('ex') RETURNING id"
    )


async def _flag(conn):
    from uuid import uuid4

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
    result = await create_persona(conn)
    assert result.id is not None

    items = await get_personas(conn, [result.id])
    assert len(items) == 1
    assert items[0].active is True
    assert items[0].generated is False
    assert items[0].mcp is False


async def test_passes_base_flags(conn):
    result = await create_persona(conn, active=False, generated=True, mcp=True)

    # active=False means get_personas (filters active=true) won't return it
    row = await conn.fetchrow(
        "SELECT active, generated, mcp FROM persona_artifact WHERE id = $1",
        result.id,
    )
    assert row["active"] is False
    assert row["generated"] is True
    assert row["mcp"] is True


async def test_links_single_select_junctions(conn):
    nid = await _name(conn)
    cid = await _color(conn)
    iid = await _icon(conn)

    result = await create_persona(conn, name_id=nid, color_id=cid, icon_id=iid)

    items = await get_personas(conn, [result.id], names=True, colors=True, icons=True)
    p = items[0]
    assert p.name_ids == [nid]
    assert p.color_ids == [cid]
    assert p.icon_ids == [iid]


async def test_links_multi_select_junctions(conn):
    d1 = await _dept(conn)
    d2 = await _dept(conn)
    v1 = await _voice(conn)

    result = await create_persona(conn, department_ids=[d1, d2], voice_ids=[v1])

    items = await get_personas(conn, [result.id], departments=True, voices=True)
    p = items[0]
    assert set(p.department_ids) == {d1, d2}
    assert p.voice_ids == [v1]


async def test_links_examples_with_idx(conn):
    e1 = await _example(conn)
    e2 = await _example(conn)

    result = await create_persona(conn, example_ids=[e1, e2])

    items = await get_personas(conn, [result.id], examples=True)
    assert set(items[0].example_ids) == {e1, e2}

    rows = await conn.fetch(
        "SELECT example_id, idx FROM persona_examples_junction "
        "WHERE persona_id = $1 AND active = true ORDER BY idx",
        result.id,
    )
    assert rows[0]["example_id"] == e1 and rows[0]["idx"] == 0
    assert rows[1]["example_id"] == e2 and rows[1]["idx"] == 1


async def test_links_flags_with_value(conn):
    f1 = await _flag(conn)
    f2 = await _flag(conn)

    result = await create_persona(conn, flag_ids={f1: True, f2: False})

    items = await get_personas(conn, [result.id], flags=True)
    assert set(items[0].flag_ids) == {f1, f2}

    rows = await conn.fetch(
        "SELECT flag_id, value FROM persona_flags_junction "
        "WHERE persona_id = $1 AND active = true",
        result.id,
    )
    vals = {r["flag_id"]: r["value"] for r in rows}
    assert vals[f1] is True
    assert vals[f2] is False


async def test_no_junctions_when_none_provided(conn):
    result = await create_persona(conn)

    items = await get_personas(
        conn,
        [result.id],
        names=True, descriptions=True, colors=True, departments=True,
        examples=True, flags=True, icons=True, instructions=True,
        parameter_fields=True, personas=True, voices=True,
    )
    p = items[0]
    assert p.name_ids == []
    assert p.department_ids == []
    assert p.example_ids == []
    assert p.flag_ids == []
    assert p.voice_ids == []
