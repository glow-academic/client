"""Training context helpers for attempt lifecycle.

Contains prepare_training_start (creates attempt_chat_entry) and
check_resolved_needs_generation (checks if generation is needed).
"""

from uuid import UUID

import asyncpg  # type: ignore

from app.v5.sql.types import (
    PrepareTrainingStartSqlParams,
    PrepareTrainingStartSqlRow,
)
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH_PREPARE_START = (
    "app/v5/sql/queries/generate/training/prepare_training_start_complete.sql"
)


async def prepare_training_start_internal(
    conn: asyncpg.Connection,
    profile_id: UUID,
    chat_entry_id: UUID,
    department_id: UUID,
    draft_id: UUID | None = None,
) -> tuple[UUID | None, UUID | None]:
    """Call prepare_training_start SQL function.

    Creates a attempt_chat_entry (if missing) and populates canonical scope links
    (scenarios, rubrics, documents, etc.) from the scenario config.

    Returns (attempt_chat_id, scenario_id).
    """
    from typing import cast

    row = cast(
        PrepareTrainingStartSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH_PREPARE_START,
            params=PrepareTrainingStartSqlParams(
                p_profile_id=profile_id,
                p_chat_entry_id=chat_entry_id,
                p_department_id=department_id,
                p_draft_id=draft_id,
            ),
        ),
    )

    if not row:
        return None, None

    return row.out_attempt_chat_id, row.out_scenario_id


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
