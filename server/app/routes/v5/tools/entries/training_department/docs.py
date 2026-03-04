"""Training department entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.training_department.get import (
    get_training_department_entries_internal,
)
from app.routes.v5.tools.entries.training_department.refresh import (
    refresh_training_department,
)
from app.routes.v5.tools.entries.training_department.search import (
    search_training_department_entries_internal,
)


async def get_training_department_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the training department entry."""
    entry_table = await get_table_info(conn, "chat_entry")

    tables = [t for t in [entry_table] if t is not None]

    return DocsResponse(
        name="training_department",
        type="entry",
        description=(
            "Training department entries provide a department-filtered view of training entries. "
            "These entries filter trainings by user department access, enabling scoped training discovery. "
            "Reads are served directly from filtered chat_entry records."
        ),
        materialized_view=None,
        tables=tables,
        operations=[
            get_operation_info(
                refresh_training_department,
                description="Refreshes training_department query caches.",
            ),
            get_operation_info(
                get_training_department_entries_internal,
                description="Batch retrieves training_department entries by IDs.",
            ),
            get_operation_info(
                search_training_department_entries_internal,
                description="Filtered paginated search against training_department entries.",
            ),
        ],
    )
