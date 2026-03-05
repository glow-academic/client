"""Persona artifact DELETE — tool layer."""

from uuid import UUID

import asyncpg

from app.routes.v5.tools.artifacts.persona.types import DeletePersonasResponse

TABLE = "persona_artifact"


async def delete_personas(
    conn: asyncpg.Connection,
    ids: list[UUID],
    *,
    soft: bool = False,
) -> DeletePersonasResponse:
    """Delete persona artifacts by IDs.

    soft=False (default): hard DELETE — junctions cascade.
    soft=True: sets active=false — data is recoverable.
    """
    if not ids:
        return DeletePersonasResponse(deleted_ids=[])

    if soft:
        deleted = await conn.fetch(
            f"UPDATE {TABLE} SET active = false WHERE id = ANY($1) RETURNING id",
            ids,
        )
    else:
        deleted = await conn.fetch(
            f"DELETE FROM {TABLE} WHERE id = ANY($1) RETURNING id",
            ids,
        )

    return DeletePersonasResponse(deleted_ids=[r["id"] for r in deleted])
