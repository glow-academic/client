"""Tests for refresh_test_invocation_bridge."""

import pytest

from app.routes.v5.tools.entries.invocation.create import create_invocation
from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.test_invocation.create import create_test_invocation
from app.routes.v5.tools.entries.test_invocation_bridge.create import (
    create_test_invocation_bridge,
)
from app.routes.v5.tools.entries.test_invocation_bridge.refresh import (
    refresh_test_invocation_bridge,
)
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def test_new_test_invocation_bridge_appears_after_refresh(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    test_invocation = await create_test_invocation(conn, session_id=session.id)
    invocation = await create_invocation(conn, session_id=session.id)
    result = await create_test_invocation_bridge(
        conn,
        test_invocation_id=test_invocation.id,
        invocation_id=invocation.id,
        session_id=session.id,
    )

    await refresh_test_invocation_bridge(conn)

    row = await conn.fetchrow(
        """
        SELECT test_invocation_id, invocation_id FROM test_invocation_bridge_entry
        WHERE test_invocation_id = $1 AND invocation_id = $2
        """,
        result.test_invocation_id,
        result.invocation_id,
    )
    assert row is not None
    assert row["test_invocation_id"] == result.test_invocation_id
    assert row["invocation_id"] == result.invocation_id


async def test_new_test_invocation_bridge_not_visible_before_refresh(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    test_invocation = await create_test_invocation(conn, session_id=session.id)
    invocation = await create_invocation(conn, session_id=session.id)
    result = await create_test_invocation_bridge(
        conn,
        test_invocation_id=test_invocation.id,
        invocation_id=invocation.id,
        session_id=session.id,
    )

    # Before refresh, the entry should not be visible via SQL query
    rows = await conn.fetch(
        """
        SELECT test_invocation_id, invocation_id FROM test_invocation_bridge_entry
        WHERE test_invocation_id = $1 AND invocation_id = $2 AND active = true
        """,
        result.test_invocation_id,
        result.invocation_id,
    )
    assert len(rows) == 0
