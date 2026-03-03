"""Training context helpers for attempt lifecycle.

Contains prepare_training_start (creates attempt_chat_entry) and
check_resolved_needs_generation (checks if generation is needed).
"""

from uuid import UUID

import asyncpg  # type: ignore


async def check_resolved_needs_generation(
    conn: asyncpg.Connection,
    attempt_chat_id: UUID,
) -> bool:
    """Return True if the resolved entry is missing generated persona connections.

    The prepare_training_start SQL copies canonical scope links (scenarios, rubrics,
    documents, etc.) but does NOT create persona or parameter connections — those
    come from generation. If personas are empty, generation is needed.
    """
    row = await conn.fetchval(
        """
        SELECT COUNT(*) = 0
        FROM attempt_chat_profile_personas_connection
        WHERE attempt_chat_id = $1 AND active = true
        """,
        attempt_chat_id,
    )
    return bool(row)
