"""Runs CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.runs.types import CreateRunResponse


async def create_run(
    conn: asyncpg.Connection,
    group_id: UUID,
    session_id: UUID,
    profiles_id: UUID | None = None,
    agent_ids: list[UUID] | None = None,
    mcp: bool = False,
    # TODO: Migrate create_tool_call + draft endpoints to pass profiles_id,
    #       then remove this param.
    profile_id: UUID | None = None,
) -> CreateRunResponse:
    """Create a runs entry with optional profile and agent links.

    ``profiles_id`` is the profiles_resource.id (parent resource),
    resolved at the client boundary via ProfileContext.
    ``profile_id`` is a deprecated alias kept for callers that haven't migrated.
    """
    run_id = await conn.fetchval(
        """
        INSERT INTO runs_entry (session_id, group_id, mcp, generated)
        VALUES ($1, $2, $3, true)
        RETURNING id
    """,
        session_id,
        group_id,
        mcp,
    )

    if run_id is None:
        raise ValueError("Failed to create runs entry")

    # Link run → profiles_resource
    resolved_profiles_id = profiles_id or profile_id
    if resolved_profiles_id is not None:
        await conn.execute(
            """
            INSERT INTO profiles_runs_connection (profiles_id, run_id)
            VALUES ($1, $2)
        """,
            resolved_profiles_id,
            run_id,
        )

    # Link run → agents_resource
    if agent_ids:
        await conn.execute(
            """INSERT INTO runs_agents_connection (run_id, agents_id, created_at, active, generated, mcp)
            SELECT $1, a.id, NOW(), true, false, $2
            FROM agents_resource a
            WHERE a.id = ANY($3::uuid[])
            ON CONFLICT (run_id, agents_id) DO NOTHING""",
            run_id,
            mcp,
            agent_ids,
        )

    return CreateRunResponse(id=run_id)
