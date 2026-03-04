"""Problems GET — batch get from problems_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.problems.types import GetProblemResponse

MV_NAME = "problems_mv"


async def get_problems(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_mv: bool = False,
) -> list[GetProblemResponse]:
    """Get problems by IDs from problems_mv."""
    if not ids:
        return []

    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT problem_id, profile_id, session_id, type, message, resolved, created_at, active, mcp, generated
        FROM {source}
        WHERE problem_id = ANY($1)
        """,
        ids,
    )

    return [
        GetProblemResponse(
            id=r["problem_id"],
            profile_id=r["profile_id"],
            session_id=r["session_id"],
            type=r["type"],
            message=r["message"],
            resolved=r["resolved"],
            created_at=r["created_at"],
            active=r["active"],
            mcp=r["mcp"],
            generated=r["generated"],
        )
        for r in rows
    ]
