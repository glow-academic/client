"""Questions CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore
from redis.asyncio import Redis

from app.routes.v5.tools.resources.questions.get import get_questions
from app.routes.v5.tools.resources.questions.types import GetQuestionResponse
from app.utils.cache.invalidate_tags import invalidate_tags


async def create_question(
    conn: asyncpg.Connection,
    question_text: str,
    time: int,
    redis: Redis,
    allow_multiple: bool = False,
    mcp: bool = False,
    soft: bool = False,
    group_id: UUID | None = None,
    tool_id: UUID | None = None,
) -> GetQuestionResponse:
    """Create a question resource."""
    question_id = await conn.fetchval(
        """
        INSERT INTO questions_resource (question_text, time, allow_multiple, active, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, $5)
        RETURNING id
    """,
        question_text,
        time,
        allow_multiple,
        not soft,
        mcp,
    )

    await invalidate_tags(["resources", "questions"], redis=redis)
    items = await get_questions(conn, [question_id], redis, bypass_cache=True)
    return items[0]
