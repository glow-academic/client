"""Tests for create_benchmark."""

import pytest

from app.routes.v5.tools.entries.benchmark.create import create_benchmark
from app.routes.v5.tools.entries.benchmark.get import get_benchmarks
from app.routes.v5.tools.entries.benchmark.refresh import refresh_benchmark
from tests.seed_ids import SUPERADMIN_PROFILES_RESOURCE_ID, UNIVERSITY_DEPT_ID

pytestmark = pytest.mark.asyncio


async def _benchmark(conn, **overrides):
    defaults = dict(
        profiles_ids=[SUPERADMIN_PROFILES_RESOURCE_ID],
        departments_ids=[UNIVERSITY_DEPT_ID],
    )
    defaults.update(overrides)
    return await create_benchmark(conn, **defaults)


async def test_returns_id(conn):
    result = await _benchmark(conn)

    assert result.id is not None


async def test_visible_via_get_after_refresh(conn):
    result = await _benchmark(conn)
    await refresh_benchmark(conn)

    items = await get_benchmarks(conn, [result.id])

    assert len(items) == 1
    assert items[0].benchmark_id == result.id
    assert items[0].profile_ids == [SUPERADMIN_PROFILES_RESOURCE_ID]
    assert items[0].department_ids == [UNIVERSITY_DEPT_ID]


async def test_passes_mcp_flag(conn):
    result = await _benchmark(conn, mcp=True)

    row = await conn.fetchrow(
        "SELECT mcp FROM benchmark_entry WHERE id = $1",
        result.id,
    )
    assert row is not None
    assert row["mcp"] is True
