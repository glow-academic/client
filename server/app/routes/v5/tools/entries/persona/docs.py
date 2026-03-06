"""Persona entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.persona.create import create_persona
from app.routes.v5.tools.entries.persona.get import get_persona_entries_internal


async def get_persona_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the persona entry."""
    entry_table = await get_table_info(conn, "personas_entry")
    personas_connection = await get_table_info(conn, "personas_personas_connection")

    tables = [t for t in [entry_table, personas_connection] if t is not None]

    return DocsResponse(
        name="persona",
        type="entry",
        description=(
            "Persona entries represent character profiles used in simulations. "
            "Each persona can optionally link to a personas resource via the personas_personas_connection table. "
            "Reads are served directly from the personas_entry table."
        ),
        materialized_view=None,
        tables=tables,
        operations=[
            get_operation_info(
                create_persona,
                description="Creates a new persona entry with optional link to personas resource.",
            ),
            get_operation_info(
                get_persona_entries_internal,
                description="Batch retrieves persona entries by IDs from personas_entry.",
            ),
        ],
    )
