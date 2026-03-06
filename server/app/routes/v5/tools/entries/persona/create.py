"""Persona CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.persona.types import CreatePersonaResponse


async def create_persona(
    conn: asyncpg.Connection,
    personas_id: UUID | None = None,
    mcp: bool = False,
    soft: bool = False,
) -> CreatePersonaResponse:
    """Create a personas entry with optional resource link."""
    persona_id = await conn.fetchval(
        """
        INSERT INTO personas_entry (active, mcp, generated)
        VALUES ($1, $2, true)
        RETURNING id
        """,
        not soft,
        mcp,
    )

    if persona_id is None:
        raise ValueError("Failed to create personas entry")

    # Link to personas_resource via connection table
    if personas_id is not None:
        await conn.execute(
            """
            INSERT INTO personas_personas_connection (personas_entry_id, personas_id, generated)
            VALUES ($1, $2, true)
            """,
            persona_id,
            personas_id,
        )

    return CreatePersonaResponse(id=persona_id)
