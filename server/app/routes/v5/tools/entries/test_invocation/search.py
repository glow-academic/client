"""Test invocation search — filtered/paginated query against test_invocation_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.test_invocation.types import GetTestInvocationResponse

MV_NAME = "test_invocation_mv"


async def search_test_invocation_entries_internal(
    conn: asyncpg.Connection,
    test_ids: list[UUID] | None = None,
    group_ids: list[UUID] | None = None,
    suite_department_ids: list[UUID] | None = None,
    grade_ids: list[UUID] | None = None,
    rubric_ids: list[UUID] | None = None,
    model_ids: list[UUID] | None = None,
    prompt_ids: list[UUID] | None = None,
    voice_ids: list[UUID] | None = None,
    temperature_level_ids: list[UUID] | None = None,
    reasoning_level_ids: list[UUID] | None = None,
    key_ids: list[UUID] | None = None,
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
        WHERE ($1::uuid[] IS NULL OR test_id = ANY($1))
          AND ($2::uuid[] IS NULL OR group_id = ANY($2))
          AND ($3::uuid[] IS NULL OR department_ids && $3)
          AND ($4::uuid[] IS NULL OR grade_id = ANY($4))
          AND ($5::uuid[] IS NULL OR rubric_id = ANY($5))
          AND ($6::uuid[] IS NULL OR model_id = ANY($6))
          AND ($7::uuid[] IS NULL OR voice_id = ANY($7))
          AND ($8::uuid[] IS NULL OR temperature_level_id = ANY($8))
          AND ($9::uuid[] IS NULL OR reasoning_level_id = ANY($9))
          AND ($10::uuid[] IS NULL OR key_id = ANY($10))
        ORDER BY invocation_created_at DESC
        LIMIT $11 OFFSET $12
        """,
        test_ids,
        group_ids,
        suite_department_ids,
        grade_ids,
        rubric_ids,
        model_ids,
        voice_ids,
        temperature_level_ids,
        reasoning_level_ids,
        key_ids,
        limit,
        offset,
    )

    return [GetTestInvocationResponse(**dict(r)) for r in rows]
