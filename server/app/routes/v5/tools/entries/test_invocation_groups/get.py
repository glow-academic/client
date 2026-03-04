"""Entry get — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.test_invocation_groups.types import (
    GetTestInvocationGroupsResponse,
)

MV_NAME = "test_invocation_groups_mv"


async def get_test_invocation_groups(
    conn: asyncpg.Connection,
    ids: list[UUID],
) -> list[GetTestInvocationGroupsResponse]:
    """Get test_invocation_groups entries by IDs from MV."""
    if not ids:
        return []
    rows = await conn.fetch(f"SELECT * FROM {MV_NAME} WHERE id = ANY($1)", ids)
    return [GetTestInvocationGroupsResponse(**dict(r)) for r in rows]
