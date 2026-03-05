"""Entry search — filtered/paginated query against test_invocation_groups_mv."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.test_invocation_groups.types import (
    GetTestInvocationGroupsResponse,
)

MV_NAME = "test_invocation_groups_mv"


async def search_test_invocation_groups(
    conn: asyncpg.Connection,
    test_invocation_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[GetTestInvocationGroupsResponse]:
    """Search test_invocation_groups from test_invocation_groups_mv with declarative filters."""
    rows = await conn.fetch(
        f"""
        SELECT *
        FROM {MV_NAME}
        WHERE ($1::uuid IS NULL OR test_invocation_id = $1)
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        test_invocation_id,
        limit,
        offset,
    )
    return [GetTestInvocationGroupsResponse(**dict(r)) for r in rows]
