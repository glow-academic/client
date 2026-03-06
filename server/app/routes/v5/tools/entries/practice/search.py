"""Practice search — filtered/paginated query against practice_mv."""

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.practice.types import GetPracticeResponse

MV_NAME = "practice_mv"


async def search_practices(
    conn: asyncpg.Connection,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetPracticeResponse]:
    """Search practice entries from practice_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT practice_id, simulation_ids, cohort_ids, department_ids,
               profile_ids, chat_ids, scenario_ids,
               created_at, updated_at, active
        FROM {source}
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        """,
        limit,
        offset,
    )

    return [
        GetPracticeResponse(
            id=r["practice_id"],
            simulation_ids=r["simulation_ids"],
            cohort_ids=r["cohort_ids"],
            department_ids=r["department_ids"],
            profile_ids=r["profile_ids"],
            chat_ids=r["chat_ids"],
            scenario_ids=r["scenario_ids"],
            created_at=r["created_at"],
            updated_at=r["updated_at"],
            active=r["active"],
        )
        for r in rows
    ]
