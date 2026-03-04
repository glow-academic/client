"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.test_invocation_groups.types import (
    CreateTestInvocationGroupsResponse,
)


async def create_test_invocation_groups(
    conn: asyncpg.Connection,
    test_invocation_id: UUID,
    agent_ids: list[UUID] | None = None,
    group_ids: list[UUID] | None = None,
    mcp: bool = False,
) -> CreateTestInvocationGroupsResponse:
    """Create a test_invocation_groups entry with optional connections."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO test_invocation_groups_entry (test_invocation_id, mcp, generated)
        VALUES ($1, $2, true)
        RETURNING id
        """,
        test_invocation_id,
        mcp,
    )

    if agent_ids:
        for agent_id in agent_ids:
            await conn.execute(
                """
                INSERT INTO test_invocation_groups_agents_connection
                    (test_invocation_groups_id, agents_id)
                VALUES ($1, $2)
                """,
                entry_id,
                agent_id,
            )

    if group_ids:
        for group_id in group_ids:
            await conn.execute(
                """
                INSERT INTO test_invocation_groups_groups_connection
                    (test_invocation_groups_id, groups_id)
                VALUES ($1, $2)
                """,
                entry_id,
                group_id,
            )

    return CreateTestInvocationGroupsResponse(id=entry_id)
