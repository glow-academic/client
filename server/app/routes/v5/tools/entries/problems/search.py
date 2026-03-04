"""Problems search — filtered/paginated query against problems_mv."""

from datetime import datetime
from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.problems.types import GetProblemResponse

MV_NAME = "problems_mv"


async def search_problems(
    conn: asyncpg.Connection,
    profile_id: UUID | None = None,
    session_id: UUID | None = None,
    type: str | None = None,
    resolved: bool | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    mcp: bool | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetProblemResponse]:
    """Search problems from problems_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT problem_id, profile_id, session_id, type, message, resolved, created_at, active, mcp, generated
        FROM {source}
        WHERE ($1::uuid IS NULL OR profile_id = $1)
          AND ($2::uuid IS NULL OR session_id = $2)
          AND ($3::text IS NULL OR type = $3)
          AND ($4::boolean IS NULL OR resolved = $4)
          AND ($5::timestamptz IS NULL OR created_at >= $5)
          AND ($6::timestamptz IS NULL OR created_at <= $6)
          AND ($7::boolean IS NULL OR mcp = $7)
        ORDER BY created_at DESC
        LIMIT $8 OFFSET $9
        """,
        profile_id,
        session_id,
        type,
        resolved,
        date_from,
        date_to,
        mcp,
        limit,
        offset,
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
