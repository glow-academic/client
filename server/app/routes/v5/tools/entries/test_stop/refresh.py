"""Entry refresh — reusable data-access layer."""

import asyncpg

MV_NAME = "test_stop_mv"


async def refresh_test_stop(conn: asyncpg.Connection) -> None:
    """Refresh test_stop_mv concurrently."""
    await conn.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {MV_NAME}")
