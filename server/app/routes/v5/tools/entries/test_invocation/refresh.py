"""Test invocation refresh — reusable data-access layer."""

import asyncpg

MV_NAME = "test_invocation_mv"


async def refresh_test_invocation(conn: asyncpg.Connection) -> None:
    """Refresh test_invocation_mv."""
    await conn.execute(f"REFRESH MATERIALIZED VIEW {MV_NAME}")
