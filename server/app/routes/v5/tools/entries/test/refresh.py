"""Test refresh — reusable data-access layer."""

import asyncpg

MV_NAME = "test_mv"


async def refresh_test(conn: asyncpg.Connection) -> None:
    """Refresh test_mv."""
    await conn.execute(f"REFRESH MATERIALIZED VIEW {MV_NAME}")
