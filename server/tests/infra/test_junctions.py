"""Tests for infra.junctions — reusable junction upsert/insert helpers.

Uses persona_* junction tables as a concrete test bed, but the functions
themselves are artifact-agnostic.
"""

import pytest

from app.infra.junctions import (
    insert_multi,
    insert_single,
    upsert_multi,
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


