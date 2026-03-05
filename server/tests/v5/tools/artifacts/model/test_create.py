"""Tests for create_model."""

from uuid import uuid4

import pytest

from app.routes.v5.tools.artifacts.model.create import create_model
from app.routes.v5.tools.artifacts.model.get import get_models

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers — create resource rows with required NOT NULL columns
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


async def _voice(conn):
    return await conn.fetchval(
        "INSERT INTO voices_resource (voice) VALUES ($1) RETURNING id",
        f"v-{uuid4().hex[:8]}",
    )


async def _quality(conn):
    return await conn.fetchval(
        "INSERT INTO qualities_resource (quality) VALUES ('low') RETURNING id",
    )


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_creates_bare_artifact(conn):
    result = await create_model(conn)
    assert result.id is not None

    items = await get_models(conn, [result.id])
    assert len(items) == 1
    assert items[0].generated is False
    assert items[0].mcp is False


async def test_links_single_and_multi(conn):
    nid = await _name(conn)
    d1 = await _dept(conn)
    d2 = await _dept(conn)
    v1 = await _voice(conn)

    result = await create_model(
        conn, name_id=nid, department_ids=[d1, d2], voice_ids=[v1]
    )

    items = await get_models(
        conn, [result.id], names=True, departments=True, voices=True
    )
    p = items[0]
    assert p.name_ids == [nid]
    assert set(p.department_ids) == {d1, d2}
    assert p.voice_ids == [v1]


async def test_links_flags_with_value(conn):
    f1 = await _flag(conn)
    f2 = await _flag(conn)

    result = await create_model(conn, flag_ids={f1: True, f2: False})

    items = await get_models(conn, [result.id], flags=True)
    assert set(items[0].flag_ids) == {f1, f2}

    rows = await conn.fetch(
        "SELECT flag_id, value FROM model_flags_junction "
        "WHERE model_id = $1 AND active = true",
        result.id,
    )
    vals = {r["flag_id"]: r["value"] for r in rows}
    assert vals[f1] is True
    assert vals[f2] is False


async def test_links_qualities(conn):
    q1 = await _quality(conn)
    q2 = await _quality(conn)

    result = await create_model(conn, quality_ids=[q1, q2])

    items = await get_models(conn, [result.id], qualities=True)
    assert set(items[0].quality_ids) == {q1, q2}


async def test_no_junctions_when_none_provided(conn):
    result = await create_model(conn)

    items = await get_models(
        conn,
        [result.id],
        names=True, descriptions=True, departments=True,
        flags=True, modalities=True, pricing=True,
        providers=True, qualities=True, reasoning_levels=True,
        temperature_levels=True, values=True, voices=True, models=True,
    )
    p = items[0]
    assert p.name_ids == []
    assert p.description_ids == []
    assert p.department_ids == []
    assert p.flag_ids == []
    assert p.modality_ids == []
    assert p.pricing_ids == []
    assert p.provider_ids == []
    assert p.quality_ids == []
    assert p.reasoning_level_ids == []
    assert p.temperature_level_ids == []
    assert p.value_ids == []
    assert p.voice_ids == []
    assert p.model_ids == []
