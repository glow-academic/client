"""Small DB helper functions extracted from socket handlers.

Thin wrappers around inline SQL that was embedded in generate.py,
generate_prepare.py, and generate_run_complete.py.
"""

from __future__ import annotations

from uuid import UUID

import asyncpg


async def get_group_from_draft(
    conn: asyncpg.Connection,
    draft_table: str,
    draft_id: UUID,
) -> UUID | None:
    """Look up the group_id for a draft entry."""
    # draft_table is derived from artifact_type (e.g. "agent_drafts_entry")
    # We use parameterised table name — safe because caller constructs it from
    # artifact_type which comes from the REGISTRY (not user input).
    return await conn.fetchval(
        f"SELECT group_id FROM {draft_table} WHERE id = $1",  # noqa: S608
        draft_id,
    )


async def create_group_for_profile(
    conn: asyncpg.Connection,
    profile_id: UUID,
) -> UUID | None:
    """Create a new group linked to the profile's active session."""
    return await conn.fetchval(
        """INSERT INTO groups_entry (created_at, updated_at, session_id)
        VALUES (NOW(), NOW(), (
            SELECT id FROM sessions_entry
            WHERE profile_id = $1 AND active = true
            ORDER BY created_at DESC LIMIT 1
        )) RETURNING id""",
        profile_id,
    )


async def link_profile_to_run(
    conn: asyncpg.Connection,
    profile_id: UUID,
    run_id: UUID,
) -> None:
    """Create profiles_runs_connection via profile_profiles_junction."""
    await conn.execute(
        """INSERT INTO profiles_runs_connection (profiles_id, run_id)
        SELECT ppj.profiles_id, $2
        FROM profile_profiles_junction ppj
        WHERE ppj.profile_id = $1
        LIMIT 1""",
        profile_id,
        run_id,
    )


async def link_run_agents(
    conn: asyncpg.Connection,
    run_id: UUID,
    agent_ids: list[UUID],
) -> None:
    """Link a run to its assigned agents (runs_agents_connection)."""
    if not agent_ids:
        return
    await conn.execute(
        """INSERT INTO runs_agents_connection (run_id, agents_id, created_at, active, generated, mcp)
        SELECT $1, a.id, NOW(), true, false, false
        FROM agents_resource a
        WHERE a.id = ANY($2::uuid[])
        ON CONFLICT (run_id, agents_id) DO NOTHING""",
        run_id,
        agent_ids,
    )


async def check_assistant_message_exists(
    conn: asyncpg.Connection,
    run_id: UUID,
) -> bool:
    """Check if an assistant message already exists for this run (dedup)."""
    existing = await conn.fetchval(
        """SELECT id FROM messages_entry
        WHERE run_id = $1 AND role = 'assistant'::message_type
        LIMIT 1""",
        run_id,
    )
    return existing is not None


async def record_tokens(
    conn: asyncpg.Connection,
    run_id: UUID,
    input_tokens: int,
    output_tokens: int,
) -> None:
    """Insert token count entry for a run."""
    await conn.execute(
        """INSERT INTO tokens_entry (run_id, input_tokens, output_tokens)
        VALUES ($1, COALESCE($2, 0), COALESCE($3, 0))""",
        run_id,
        input_tokens,
        output_tokens,
    )
