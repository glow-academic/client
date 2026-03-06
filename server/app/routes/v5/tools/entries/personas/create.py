"""Personas CREATE — insert entry + connection table."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.personas.types import CreatePersonasResponse


async def create_personas(
    conn: asyncpg.Connection,
    session_id: UUID | None = None,
    mcp: bool = False,
    soft: bool = False,
    persona_ids: list[UUID] | None = None,
) -> CreatePersonasResponse:
    """Create a personas entry with optional persona connections."""
    entry_id = await conn.fetchval(
        """
        INSERT INTO personas_entry (session_id, active, mcp, generated)
        VALUES ($1, $2, $3, true)
        RETURNING id
    """,
        session_id,
        not soft,
        mcp,
    )

    if entry_id is None:
        raise ValueError("Failed to create personas entry")

    for pid in persona_ids or []:
        await conn.execute(
            "INSERT INTO personas_personas_connection (personas_entry_id, personas_id) VALUES ($1, $2)",
            entry_id,
            pid,
        )

    return CreatePersonasResponse(id=entry_id)
