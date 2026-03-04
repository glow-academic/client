"""Tokens CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.tokens.types import CreateTokenResponse


async def create_token(
    conn: asyncpg.Connection,
    run_id: UUID,
    input_tokens: int = 0,
    output_tokens: int = 0,
    cached_input_tokens: int = 0,
    session_id: UUID | None = None,
    mcp: bool = False,
) -> CreateTokenResponse:
    """Create a tokens entry."""
    token_id = await conn.fetchval(
        """
        INSERT INTO tokens_entry (run_id, input_tokens, output_tokens, cached_input_tokens, session_id, mcp, generated)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING id
        """,
        run_id,
        input_tokens,
        output_tokens,
        cached_input_tokens,
        session_id,
        mcp,
    )

    if token_id is None:
        raise ValueError("Failed to create tokens entry")

    return CreateTokenResponse(id=token_id)
