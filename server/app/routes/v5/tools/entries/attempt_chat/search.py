"""Attempt chat search — filtered/paginated query against attempt_chat_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.attempt_chat.types import GetAttemptChatResponse

MV_NAME = "attempt_chat_mv"


async def search_attempt_chat_entries_internal(
    conn: asyncpg.Connection,
    attempt_id: UUID | None = None,
    group_id: UUID | None = None,
    attempt_chat_id: UUID | None = None,
    profile_id: UUID | None = None,
    cohort_id: UUID | None = None,
    department_id: UUID | None = None,
    simulation_id: UUID | None = None,
    scenario_id: UUID | None = None,
    user_persona_id: UUID | None = None,
    rubric_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetAttemptChatResponse]:
    """Search attempt_chat entries from attempt_chat_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT chat_id, attempt_id, chat_entry_id, group_id,
               profile_id, cohort_id, department_id, simulation_id,
               scenario_id, persona_ids, rubric_id,
               grade_score, grade_total_points, grade_pass_points,
               grade_passed, grade_time_taken,
               completed, attempt_number, chat_created_at, attempt_date,
               attempt_type, is_archived, infinite_mode
        FROM {source}
        WHERE ($1::uuid IS NULL OR attempt_id = $1)
          AND ($2::uuid IS NULL OR group_id = $2)
          AND ($3::uuid IS NULL OR chat_id = $3)
          AND ($4::uuid IS NULL OR profile_id = $4)
          AND ($5::uuid IS NULL OR cohort_id = $5)
          AND ($6::uuid IS NULL OR department_id = $6)
          AND ($7::uuid IS NULL OR simulation_id = $7)
          AND ($8::uuid IS NULL OR scenario_id = $8)
          AND ($9::uuid IS NULL OR $9 = ANY(persona_ids))
          AND ($10::uuid IS NULL OR rubric_id = $10)
        ORDER BY chat_created_at DESC
        LIMIT $11 OFFSET $12
        """,
        attempt_id,
        group_id,
        attempt_chat_id,
        profile_id,
        cohort_id,
        department_id,
        simulation_id,
        scenario_id,
        user_persona_id,
        rubric_id,
        limit,
        offset,
    )

    return [GetAttemptChatResponse(**dict(r)) for r in rows]
