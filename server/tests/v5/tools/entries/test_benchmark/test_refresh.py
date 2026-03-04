"""Tests for refresh_test_benchmark."""

import pytest

from app.routes.v5.tools.entries.benchmark.create import create_benchmark
from app.routes.v5.tools.entries.sessions.create import create_session
from app.routes.v5.tools.entries.test.create import create_test
from app.routes.v5.tools.entries.test_benchmark.create import create_test_benchmark
from app.routes.v5.tools.entries.test_benchmark.refresh import refresh_test_benchmark
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID

pytestmark = pytest.mark.asyncio


async def test_new_test_benchmark_appears_after_refresh(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    test = await create_test(conn, session_id=session.id)
    benchmark = await create_benchmark(conn, session_id=session.id)
    result = await create_test_benchmark(
        conn,
        test_id=test.id,
        benchmark_id=benchmark.id,
        session_id=session.id,
    )

    await refresh_test_benchmark(conn)

    row = await conn.fetchrow(
        """
        SELECT test_id, benchmark_id FROM test_benchmark_entry
        WHERE test_id = $1 AND benchmark_id = $2
        """,
        result.test_id,
        result.benchmark_id,
    )
    assert row is not None
    assert row["test_id"] == result.test_id
    assert row["benchmark_id"] == result.benchmark_id


async def test_new_test_benchmark_not_visible_before_refresh(conn):
    session = await create_session(conn, profile_id=SUPERADMIN_PROFILES_RESOURCE_ID)
    test = await create_test(conn, session_id=session.id)
    benchmark = await create_benchmark(conn, session_id=session.id)
    result = await create_test_benchmark(
        conn,
        test_id=test.id,
        benchmark_id=benchmark.id,
        session_id=session.id,
    )

    # Before refresh, the entry should not be visible via SQL query
    rows = await conn.fetch(
        """
        SELECT test_id, benchmark_id FROM test_benchmark_entry
        WHERE test_id = $1 AND benchmark_id = $2 AND active = true
        """,
        result.test_id,
        result.benchmark_id,
    )
    assert len(rows) == 0
