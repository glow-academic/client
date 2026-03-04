"""Health entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.health.create import create_health
from app.routes.v5.tools.entries.health.get import get_health_entries_internal


async def get_health_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the health entry."""
    entry_table = await get_table_info(conn, "health_entry")

    tables = [t for t in [entry_table] if t is not None]

    return DocsResponse(
        name="health",
        type="entry",
        description=(
            "Health entries track service health checks and metrics. "
            "Each health entry stores information about service status, latency, and error messages. "
            "Reads are served directly from the health_entry table."
        ),
        materialized_view=None,
        tables=tables,
        operations=[
            get_operation_info(
                create_health,
                description=(
                    "Creates a new health entry with service status, latency, and optional error information."
                ),
            ),
            get_operation_info(
                get_health_entries_internal,
                description="Batch retrieves health entries by IDs from health_entry.",
            ),
        ],
    )
