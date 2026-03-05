"""Tests for infra.junctions — reusable junction upsert/insert helpers.

Uses persona_* junction tables as a concrete test bed, but the functions
themselves are artifact-agnostic.
"""

import pytest

from app.infra.junctions import (
    insert_multi,
    insert_multi_with_idx,
    insert_multi_with_value,
    insert_single,
    upsert_multi,
    upsert_multi_with_idx,
    upsert_multi_with_value,
    upsert_single,
)

pytestmark = pytest.mark.asyncio

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

OWNER_COL = "persona_id"


async def _make_persona(conn):
    return await conn.fetchval(
        "INSERT INTO persona_artifact (generated, mcp) VALUES (false, false) RETURNING id"
    )


async def _make_name(conn):
    from uuid import uuid4

    return await conn.fetchval(
        "INSERT INTO names_resource (name) VALUES ($1) RETURNING id",
        f"test-{uuid4().hex[:8]}",
    )


async def _make_dept(conn):
    return await conn.fetchval(
        "INSERT INTO departments_resource DEFAULT VALUES RETURNING id"
    )


async def _make_example(conn):
    return await conn.fetchval(
        "INSERT INTO examples_resource (example) VALUES ('ex') RETURNING id"
    )


async def _make_flag(conn):
    return await conn.fetchval(
        "INSERT INTO flags_resource (name, description, icon) VALUES ('f', 'd', 'i') RETURNING id"
    )


async def _active_ids(conn, table, owner_id, resource_col):
    rows = await conn.fetch(
        f"SELECT {resource_col} FROM {table} "
        f"WHERE {OWNER_COL} = $1 AND active = true",
        owner_id,
    )
    return {r[resource_col] for r in rows}


# ---------------------------------------------------------------------------
# insert_single
# ---------------------------------------------------------------------------


async def test_insert_single(conn):
    pid = await _make_persona(conn)
    nid = await _make_name(conn)

    await insert_single(
        conn,
        table="persona_names_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="name_id",
        resource_id=nid,
    )

    ids = await _active_ids(conn, "persona_names_junction", pid, "name_id")
    assert ids == {nid}


# ---------------------------------------------------------------------------
# insert_multi
# ---------------------------------------------------------------------------


async def test_insert_multi(conn):
    pid = await _make_persona(conn)
    d1 = await _make_dept(conn)
    d2 = await _make_dept(conn)

    await insert_multi(
        conn,
        table="persona_departments_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="department_id",
        resource_ids=[d1, d2],
    )

    ids = await _active_ids(conn, "persona_departments_junction", pid, "department_id")
    assert ids == {d1, d2}


async def test_insert_multi_empty_is_noop(conn):
    pid = await _make_persona(conn)

    await insert_multi(
        conn,
        table="persona_departments_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="department_id",
        resource_ids=[],
    )

    ids = await _active_ids(conn, "persona_departments_junction", pid, "department_id")
    assert ids == set()


# ---------------------------------------------------------------------------
# insert_multi_with_idx
# ---------------------------------------------------------------------------


async def test_insert_multi_with_idx(conn):
    pid = await _make_persona(conn)
    e1 = await _make_example(conn)
    e2 = await _make_example(conn)

    await insert_multi_with_idx(
        conn,
        table="persona_examples_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="example_id",
        resource_ids=[e1, e2],
    )

    rows = await conn.fetch(
        "SELECT example_id, idx FROM persona_examples_junction "
        "WHERE persona_id = $1 AND active = true ORDER BY idx",
        pid,
    )
    assert rows[0]["example_id"] == e1 and rows[0]["idx"] == 0
    assert rows[1]["example_id"] == e2 and rows[1]["idx"] == 1


# ---------------------------------------------------------------------------
# insert_multi_with_value
# ---------------------------------------------------------------------------


async def test_insert_multi_with_value(conn):
    pid = await _make_persona(conn)
    f1 = await _make_flag(conn)
    f2 = await _make_flag(conn)

    await insert_multi_with_value(
        conn,
        table="persona_flags_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="flag_id",
        resource_values={f1: True, f2: False},
    )

    rows = await conn.fetch(
        "SELECT flag_id, value FROM persona_flags_junction "
        "WHERE persona_id = $1 AND active = true",
        pid,
    )
    vals = {r["flag_id"]: r["value"] for r in rows}
    assert vals[f1] is True
    assert vals[f2] is False


# ---------------------------------------------------------------------------
# upsert_single — replace
# ---------------------------------------------------------------------------


async def test_upsert_single_replaces_old(conn):
    pid = await _make_persona(conn)
    n1 = await _make_name(conn)
    n2 = await _make_name(conn)

    await insert_single(
        conn,
        table="persona_names_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="name_id",
        resource_id=n1,
    )

    await upsert_single(
        conn,
        table="persona_names_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="name_id",
        resource_id=n2,
        constraint="persona_names_pkey",
    )

    ids = await _active_ids(conn, "persona_names_junction", pid, "name_id")
    assert ids == {n2}

    # Old row deactivated, not deleted
    old = await conn.fetchval(
        "SELECT active FROM persona_names_junction "
        "WHERE persona_id = $1 AND name_id = $2",
        pid,
        n1,
    )
    assert old is False


async def test_upsert_single_keeps_same(conn):
    pid = await _make_persona(conn)
    n1 = await _make_name(conn)

    await insert_single(
        conn,
        table="persona_names_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="name_id",
        resource_id=n1,
    )

    await upsert_single(
        conn,
        table="persona_names_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="name_id",
        resource_id=n1,
        constraint="persona_names_pkey",
    )

    ids = await _active_ids(conn, "persona_names_junction", pid, "name_id")
    assert ids == {n1}


# ---------------------------------------------------------------------------
# upsert_multi — add, remove, keep
# ---------------------------------------------------------------------------


async def test_upsert_multi_adds_new(conn):
    pid = await _make_persona(conn)
    d1 = await _make_dept(conn)
    d2 = await _make_dept(conn)

    await insert_multi(
        conn,
        table="persona_departments_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="department_id",
        resource_ids=[d1],
    )

    await upsert_multi(
        conn,
        table="persona_departments_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="department_id",
        resource_ids=[d1, d2],
        constraint="persona_departments_pkey",
    )

    ids = await _active_ids(conn, "persona_departments_junction", pid, "department_id")
    assert ids == {d1, d2}


async def test_upsert_multi_removes_old(conn):
    pid = await _make_persona(conn)
    d1 = await _make_dept(conn)
    d2 = await _make_dept(conn)

    await insert_multi(
        conn,
        table="persona_departments_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="department_id",
        resource_ids=[d1, d2],
    )

    await upsert_multi(
        conn,
        table="persona_departments_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="department_id",
        resource_ids=[d1],
        constraint="persona_departments_pkey",
    )

    ids = await _active_ids(conn, "persona_departments_junction", pid, "department_id")
    assert ids == {d1}

    d2_active = await conn.fetchval(
        "SELECT active FROM persona_departments_junction "
        "WHERE persona_id = $1 AND department_id = $2",
        pid,
        d2,
    )
    assert d2_active is False


async def test_upsert_multi_clears_all(conn):
    pid = await _make_persona(conn)
    d1 = await _make_dept(conn)

    await insert_multi(
        conn,
        table="persona_departments_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="department_id",
        resource_ids=[d1],
    )

    await upsert_multi(
        conn,
        table="persona_departments_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="department_id",
        resource_ids=[],
        constraint="persona_departments_pkey",
    )

    ids = await _active_ids(conn, "persona_departments_junction", pid, "department_id")
    assert ids == set()


# ---------------------------------------------------------------------------
# upsert_multi_with_idx — reorder
# ---------------------------------------------------------------------------


async def test_upsert_multi_with_idx_reorders(conn):
    pid = await _make_persona(conn)
    e1 = await _make_example(conn)
    e2 = await _make_example(conn)

    await insert_multi_with_idx(
        conn,
        table="persona_examples_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="example_id",
        resource_ids=[e1, e2],
    )

    # Reverse order
    await upsert_multi_with_idx(
        conn,
        table="persona_examples_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="example_id",
        resource_ids=[e2, e1],
        constraint="persona_examples_pkey",
    )

    rows = await conn.fetch(
        "SELECT example_id, idx FROM persona_examples_junction "
        "WHERE persona_id = $1 AND active = true ORDER BY idx",
        pid,
    )
    assert rows[0]["example_id"] == e2 and rows[0]["idx"] == 0
    assert rows[1]["example_id"] == e1 and rows[1]["idx"] == 1


# ---------------------------------------------------------------------------
# upsert_multi_with_value — flip value
# ---------------------------------------------------------------------------


async def test_upsert_multi_with_value_flips(conn):
    pid = await _make_persona(conn)
    f1 = await _make_flag(conn)

    await insert_multi_with_value(
        conn,
        table="persona_flags_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="flag_id",
        resource_values={f1: True},
    )

    await upsert_multi_with_value(
        conn,
        table="persona_flags_junction",
        owner_col=OWNER_COL,
        owner_id=pid,
        resource_col="flag_id",
        resource_values={f1: False},
        constraint="persona_flags_pkey",
    )

    val = await conn.fetchval(
        "SELECT value FROM persona_flags_junction "
        "WHERE persona_id = $1 AND flag_id = $2 AND active = true",
        pid,
        f1,
    )
    assert val is False
