"""Training entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.training.get import get_training_entries_internal
from app.routes.v5.tools.entries.training.refresh import refresh_training
from app.routes.v5.tools.entries.training.search import search_training_entries_internal


async def get_training_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the training entry."""
    entry_table = await get_table_info(conn, "chat_entry")
    connection_tables = [
        await get_table_info(conn, "chat_scenarios_connection"),
        await get_table_info(conn, "chat_departments_connection"),
        await get_table_info(conn, "chat_descriptions_connection"),
        await get_table_info(conn, "chat_documents_connection"),
        await get_table_info(conn, "chat_flags_connection"),
        await get_table_info(conn, "chat_images_connection"),
        await get_table_info(conn, "chat_names_connection"),
        await get_table_info(conn, "chat_objectives_connection"),
        await get_table_info(conn, "chat_options_connection"),
        await get_table_info(conn, "chat_parameter_fields_connection"),
        await get_table_info(conn, "chat_personas_connection"),
        await get_table_info(conn, "chat_problem_statements_connection"),
        await get_table_info(conn, "chat_questions_connection"),
        await get_table_info(conn, "chat_videos_connection"),
    ]

    tables = [t for t in [entry_table] + connection_tables if t is not None]

    return DocsResponse(
        name="training",
        type="entry",
        description=(
            "Training entries (chat_entry) represent training bundles — "
            "top-level scenarios with configurable generation settings and optional personas, documents, "
            "parameters, problem statements, objectives, images, questions, options, and videos. "
            "Each training links to departments via connection tables. "
            "Reads are served directly from the chat_entry table and its connections."
        ),
        materialized_view=None,
        tables=tables,
        operations=[
            get_operation_info(
                refresh_training,
                description="Refreshes training query caches.",
            ),
            get_operation_info(
                get_training_entries_internal,
                description="Batch retrieves training entries by IDs.",
            ),
            get_operation_info(
                search_training_entries_internal,
                description="Filtered paginated search against training entries.",
            ),
        ],
    )
