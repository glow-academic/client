"""Entry get — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.test_stop.types import (
    GetTestStopResponse,
)

MV_NAME = "test_stop_mv"


async def get_test_stops(
    conn: asyncpg.Connection,
    ids: list[UUID],
) -> list[GetTestStopResponse]:
    """Get test_stop entries by IDs from MV."""
    if not ids:
        return []
    rows = await conn.fetch(f"SELECT * FROM {MV_NAME} WHERE id = ANY($1)", ids)
    return [GetTestStopResponse(**dict(r)) for r in rows]
