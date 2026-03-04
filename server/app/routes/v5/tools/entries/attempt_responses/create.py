"""Entry CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.attempt_responses.types import (
    CreateAttemptResponsesResponse,
)


async def create_attempt_responses(
    conn: asyncpg.Connection,
    chat_id: UUID,
    call_id: UUID,
    question_ids: list[UUID] | None = None,
    option_ids: list[UUID] | None = None,
    mcp: bool = False,
) -> CreateAttemptResponsesResponse:
    """Create an attempt_responses entry."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO attempt_responses_entry
            (chat_id, call_id, mcp, generated)
        VALUES ($1, $2, $3, true)
        RETURNING id
        """,
        chat_id,
        call_id,
        mcp,
    )

    if question_ids:
        for question_id in question_ids:
            await conn.execute(
                """
                INSERT INTO attempt_responses_questions_connection
                    (responses_id, question_id)
                VALUES ($1, $2)
                """,
                entry_id,
                question_id,
            )

    if option_ids:
        for option_id in option_ids:
            await conn.execute(
                """
                INSERT INTO attempt_responses_options_connection
                    (responses_id, option_id)
                VALUES ($1, $2)
                """,
                entry_id,
                option_id,
            )

    return CreateAttemptResponsesResponse(id=entry_id)
