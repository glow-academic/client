"""Entry search — filtered/paginated query against test_invocation_groups_mv."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.test_invocation_groups.types import (
    GetTestInvocationGroupsResponse,
)

MV_NAME = "test_invocation_groups_mv"


async def search_test_invocation_groups(
    conn: asyncpg.Connection,
    test_invocation_ids: list[UUID] | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[GetTestInvocationGroupsResponse]:
    """Search test_invocation_groups from test_invocation_groups_mv with declarative filters."""
    rows = await conn.fetch(
        f"""
        SELECT id, test_invocation_id, created_at, updated_at, generated, mcp, active,
               agent_ids, reasoning_level_ids, temperature_level_ids, voice_ids,
               prompt_ids, instruction_ids, tool_ids, quality_ids
        FROM {MV_NAME}
        WHERE ($1::uuid[] IS NULL OR test_invocation_id = ANY($1))
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        """,
        test_invocation_ids,
        limit,
        offset,
    )
    return [GetTestInvocationGroupsResponse(**dict(r)) for r in rows]
