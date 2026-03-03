"""test_invocation/refresh internal — reusable data-access layer."""

import time

import asyncpg

from app.utils.cache.invalidate_tags import invalidate_tags

MV_NAME = "test_invocation_mv"

async def refresh_test_invocation_internal(
    conn: asyncpg.Connection,
) -> dict:
    """Refresh test_invocation_mv concurrently."""
    start_time = time.time()
    await conn.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {MV_NAME}")
    duration_ms = int((time.time() - start_time) * 1000)
    await invalidate_tags(["entries", "test_invocation"])
    return {
        "success": True,
        "duration_ms": duration_ms,
        "message": f"Refreshed {MV_NAME} in {duration_ms}ms",
    }
