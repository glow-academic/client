"""Tests for infra.activate.activate — shared activate helper.

Uses persona_artifact as a concrete test bed, but the helper
itself is table-agnostic.
"""

import pytest

from app.infra.activate.activate import activate_rows

pytestmark = pytest.mark.asyncio


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _make_persona(conn, *, active=True):
    return await conn.fetchval(
        "INSERT INTO persona_artifact (active, generated, mcp) "
        "VALUES ($1, false, false) RETURNING id",
        active,
    )


# ---------------------------------------------------------------------------
# activate_rows
# ---------------------------------------------------------------------------


async def test_activate_empty_list(conn):
    """Empty list returns empty list without touching DB."""
    result = await activate_rows(conn, table="persona_artifact", ids=[])
    assert result == []


async def test_activate_inactive_artifact(conn):
    """Activating an inactive artifact sets active=true."""
    pid = await _make_persona(conn, active=False)

    # Verify it starts inactive
    row = await conn.fetchrow("SELECT active FROM persona_artifact WHERE id = $1", pid)
    assert row["active"] is False

    result = await activate_rows(conn, table="persona_artifact", ids=[pid])
    assert pid in result

    # Verify it's now active
    row = await conn.fetchrow("SELECT active FROM persona_artifact WHERE id = $1", pid)
    assert row["active"] is True


async def test_activate_already_active_artifact(conn):
    """Activating an already-active artifact is a no-op (still returns the ID)."""
    pid = await _make_persona(conn, active=True)

    result = await activate_rows(conn, table="persona_artifact", ids=[pid])
    assert pid in result

    row = await conn.fetchrow("SELECT active FROM persona_artifact WHERE id = $1", pid)
    assert row["active"] is True


async def test_activate_multiple(conn):
    """Activating multiple IDs at once works."""
    p1 = await _make_persona(conn, active=False)
    p2 = await _make_persona(conn, active=False)
    p3 = await _make_persona(conn, active=True)

    result = await activate_rows(conn, table="persona_artifact", ids=[p1, p2, p3])
    assert set(result) == {p1, p2, p3}

    for pid in [p1, p2, p3]:
        row = await conn.fetchrow(
            "SELECT active FROM persona_artifact WHERE id = $1", pid
        )
        assert row["active"] is True


async def test_activate_nonexistent_id(conn):
    """Non-existent IDs are silently skipped (not in returned list)."""
    import uuid

    fake_id = uuid.uuid4()
    result = await activate_rows(conn, table="persona_artifact", ids=[fake_id])
    assert result == []


async def test_activate_preserves_junctions(conn):
    """Activating a soft-deleted artifact preserves its junction rows."""
    pid = await _make_persona(conn, active=False)

    # Add a junction row
    name_id = await conn.fetchval(
        "INSERT INTO names_resource (name) VALUES ('test-name') RETURNING id"
    )
    await conn.execute(
        "INSERT INTO persona_names_junction (persona_id, names_id) VALUES ($1, $2)",
        pid,
        name_id,
    )

    # Activate
    await activate_rows(conn, table="persona_artifact", ids=[pid])

    # Junction still exists
    junction = await conn.fetchrow(
        "SELECT active FROM persona_names_junction WHERE persona_id = $1 AND names_id = $2",
        pid,
        name_id,
    )
    assert junction is not None
    assert junction["active"] is True
