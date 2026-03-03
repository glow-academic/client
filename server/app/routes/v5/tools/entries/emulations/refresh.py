"""emulations/refresh internal — reusable data-access layer."""

import time

import asyncpg

from app.utils.cache.invalidate_tags import invalidate_tags

MV_NAME = "emulations_mv"

async def refresh_emulations_internal(
    conn: asyncpg.Connection,
) -> dict:
    """Refresh emulations_mv concurrently."""
    start_time = time.time()
    await conn.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {MV_NAME}")
    duration_ms = int((time.time() - start_time) * 1000)
    await invalidate_tags(["entries", "emulations"])
    return {
        "success": True,
        "duration_ms": duration_ms,
        "message": f"Refreshed {MV_NAME} in {duration_ms}ms",
    }
