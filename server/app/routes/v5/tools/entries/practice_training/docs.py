"""Practice training entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_mv_info import get_mv_info
from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.practice_training.get import get_practice_training_entries_internal
from app.routes.v5.tools.entries.practice_training.refresh import refresh_practice_training
from app.routes.v5.tools.entries.practice_training.search import search_practice_training_entries_internal


async def get_practice_training_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the practice training entry."""
    mv_info = await get_mv_info(conn, "practice_training_mv")
    entry_table = await get_table_info(conn, "practice_training_entry")

    tables = [t for t in [entry_table] if t is not None]

    return DocsResponse(
        name="practice_training",
        type="entry",
        description=(
            "Practice training entries track training sessions within a practice context. "
            "These entries aggregate practice-level metadata with training-level data. "
            "Reads are served from the practice_training_mv materialized view."
        ),
        materialized_view=mv_info,
        tables=tables,
        operations=[
            get_operation_info(
                refresh_practice_training,
                description="Refreshes practice_training_mv concurrently to reflect latest writes.",
            ),
            get_operation_info(
                get_practice_training_entries_internal,
                description="Batch retrieves practice_training entries by IDs from practice_training_mv.",
            ),
            get_operation_info(
                search_practice_training_entries_internal,
                description="Filtered paginated search against practice_training_mv.",
            ),
        ],
    )
