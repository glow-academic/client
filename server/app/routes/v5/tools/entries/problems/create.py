"""Problems CREATE — insert into problems_entry with profile link."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.problems.types import CreateProblemResponse


async def create_problem(
    conn: asyncpg.Connection,
    session_id: UUID,
    type: str,
    message: str = "No message provided",
    profile_id: UUID | None = None,
    mcp: bool = False,
) -> CreateProblemResponse:
    """Create a problem entry and optionally link to a profile."""
    problem_id = await conn.fetchval(
        """
        INSERT INTO problems_entry (session_id, type, message, mcp, generated)
        VALUES ($1, $2::public.feedback_type, $3, $4, true)
        RETURNING id
        """,
        session_id,
        type,
        message,
        mcp,
    )

    if problem_id is None:
        raise ValueError("Failed to create problem entry")

    if profile_id is not None:
        await conn.execute(
            """
            INSERT INTO profiles_problems_connection (profiles_id, problem_id)
            VALUES ($1, $2)
            """,
            profile_id,
            problem_id,
        )

    return CreateProblemResponse(id=problem_id)
