"""Test invocation search — filtered/paginated query against test_invocation_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.test_invocation.types import GetTestInvocationResponse

MV_NAME = "test_invocation_mv"


async def search_test_invocation_entries_internal(
    conn: asyncpg.Connection,
    test_id: UUID | None = None,
    group_id: UUID | None = None,
    suite_department_id: UUID | None = None,
    grade_id: UUID | None = None,
    rubric_id: UUID | None = None,
    model_id: UUID | None = None,
    prompt_id: UUID | None = None,
    voice_id: UUID | None = None,
    temperature_level_id: UUID | None = None,
    reasoning_level_id: UUID | None = None,
    key_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetTestInvocationResponse]:
    """Search test_invocation entries from test_invocation_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT invocation_id, test_id, group_id, invocation_created_at,
               invocation_title, use_custom, "position", invocation_completed,
               grade_id, grade_score, grade_passed, grade_time_taken,
               rubric_id, department_ids,
               run_agent_ids, group_agent_ids, model_id, voice_id,
               temperature_level_id, reasoning_level_id, key_id
        FROM {source}
        WHERE ($1::uuid IS NULL OR test_id = $1)
          AND ($2::uuid IS NULL OR group_id = $2)
          AND ($3::uuid IS NULL OR $3 = ANY(department_ids))
          AND ($4::uuid IS NULL OR grade_id = $4)
          AND ($5::uuid IS NULL OR rubric_id = $5)
          AND ($6::uuid IS NULL OR model_id = $6)
          AND ($7::uuid IS NULL OR voice_id = $7)
          AND ($8::uuid IS NULL OR temperature_level_id = $8)
          AND ($9::uuid IS NULL OR reasoning_level_id = $9)
          AND ($10::uuid IS NULL OR key_id = $10)
        ORDER BY invocation_created_at DESC
        LIMIT $11 OFFSET $12
        """,
        test_id,
        group_id,
        suite_department_id,
        grade_id,
        rubric_id,
        model_id,
        voice_id,
        temperature_level_id,
        reasoning_level_id,
        key_id,
        limit,
        offset,
    )

    return [GetTestInvocationResponse(**dict(r)) for r in rows]
