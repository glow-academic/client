"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.entries.test_invocation_runs.types import (
    CreateTestInvocationRunsResponse,
)


async def create_test_invocation_runs(
    conn: asyncpg.Connection,
    test_invocation_id: UUID,
    agent_ids: list[UUID] | None = None,
    run_ids: list[UUID] | None = None,
    mcp: bool = False,
) -> CreateTestInvocationRunsResponse:
    """Create a test_invocation_runs entry with optional connections."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO test_invocation_runs_entry (test_invocation_id, mcp, generated)
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
                INSERT INTO test_invocation_runs_agents_connection
                    (test_invocation_runs_id, agents_id)
                VALUES ($1, $2)
                """,
                entry_id,
                agent_id,
            )

    if run_ids:
        for run_id in run_ids:
            await conn.execute(
                """
                INSERT INTO test_invocation_runs_runs_connection
                    (test_invocation_runs_id, runs_id)
                VALUES ($1, $2)
                """,
                entry_id,
                run_id,
            )

    return CreateTestInvocationRunsResponse(id=entry_id)
