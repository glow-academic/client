"""Training drafts entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.training_drafts.get import (
    get_training_drafts_entries_internal,
)
from app.routes.v5.tools.entries.training_drafts.refresh import refresh_training_drafts
from app.routes.v5.tools.entries.training_drafts.search import (
    search_training_drafts_entries_internal,
)


async def get_training_drafts_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the training drafts entry."""
    entry_table = await get_table_info(conn, "chat_drafts_entry")
    connection_tables = [
        await get_table_info(conn, "chat_drafts_departments_connection"),
        await get_table_info(conn, "chat_drafts_descriptions_connection"),
        await get_table_info(conn, "chat_drafts_documents_connection"),
        await get_table_info(conn, "chat_drafts_fields_connection"),
        await get_table_info(conn, "chat_drafts_flags_connection"),
        await get_table_info(conn, "chat_drafts_images_connection"),
        await get_table_info(conn, "chat_drafts_names_connection"),
        await get_table_info(conn, "chat_drafts_objectives_connection"),
        await get_table_info(conn, "chat_drafts_options_connection"),
        await get_table_info(conn, "chat_drafts_parameter_fields_connection"),
        await get_table_info(conn, "chat_drafts_personas_connection"),
        await get_table_info(conn, "chat_drafts_problem_statements_connection"),
        await get_table_info(conn, "chat_drafts_questions_connection"),
        await get_table_info(conn, "chat_drafts_scenarios_connection"),
        await get_table_info(conn, "chat_drafts_videos_connection"),
        await get_table_info(conn, "chat_drafts_profiles_connection"),
    ]

    tables = [t for t in [entry_table] + connection_tables if t is not None]

    return DocsResponse(
        name="training_drafts",
        type="entry",
        description=(
            "Training drafts entries (chat_drafts_entry) represent work-in-progress training versions. "
            "Each draft has a version number and links to departments, personas, documents, parameters, "
            "problem statements, objectives, images, questions, options, videos, scenarios, names, "
            "descriptions, and profiles via connection tables. "
            "Drafts allow users to edit trainings before publishing. "
            "Reads are served directly from the chat_drafts_entry table and its connections."
        ),
        materialized_view=None,
        tables=tables,
        operations=[
            get_operation_info(
                refresh_training_drafts,
                description="Refreshes training_drafts query caches.",
            ),
            get_operation_info(
                get_training_drafts_entries_internal,
                description="Batch retrieves training_drafts entries by IDs.",
            ),
            get_operation_info(
                search_training_drafts_entries_internal,
                description="Filtered paginated search against training_drafts entries.",
            ),
        ],
    )
