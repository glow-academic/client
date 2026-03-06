"""Small DB helper functions extracted from socket handlers.

Thin wrappers around inline SQL that was embedded in generate.py,
generate_prepare.py, and generate_run_complete.py.
"""

from __future__ import annotations

from uuid import UUID

import asyncpg


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
