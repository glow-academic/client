"""Certificates entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.certificates.create import (
    create_certificates_entry_internal,
)
from app.routes.v5.tools.entries.certificates.search import (
    search_certificates_entries_internal,
)


async def get_certificates_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the certificates entry."""
    entry_table = await get_table_info(conn, "certificates_entry")

    tables = [t for t in [entry_table] if t is not None]

    return DocsResponse(
        name="certificates",
        type="entry",
        description=(
            "Certificate entries record generated certificates for learners. "
            "This is a tool-driven entry with write operations tracked via call_args. "
            "Reads are served directly from the certificates_entry table."
        ),
        materialized_view=None,
        tables=tables,
        operations=[
            get_operation_info(
                create_certificates_entry_internal,
                description=(
                    "Creates a new certificate entry via tool invocation, "
                    "recording metadata and call arguments."
                ),
            ),
            get_operation_info(
                search_certificates_entries_internal,
                description="Filtered paginated search against certificates_entry.",
            ),
        ],
    )
