"""Home training entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_mv_info import get_mv_info
from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.home_training.get import (
    get_home_training_entries_internal,
)
from app.routes.v5.tools.entries.home_training.refresh import (
    refresh_home_training_internal,
)


async def get_home_training_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the home_training entry."""
    mv_info = await get_mv_info(conn, "home_training_mv")

    return DocsResponse(
        name="home_training",
        type="entry",
        description=(
            "Home training entries provide aggregated training context from the home_training_mv materialized view. "
            "This entry has no base table — it is computed entirely from the materialized view. "
            "It supports read and refresh operations only."
        ),
        materialized_view=mv_info,
        tables=[],
        operations=[
            get_operation_info(
                refresh_home_training_internal,
                description="Refreshes home_training_mv concurrently to reflect latest writes.",
            ),
            get_operation_info(
                get_home_training_entries_internal,
                description="Batch retrieves home_training entries by IDs from home_training_mv.",
            ),
        ],
    )
