"""Document Drafts entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateDocumentDraftsEntriesApiResponse,
    CreateDocumentDraftsEntriesSqlParams,
    CreateDocumentDraftsEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/document_drafts/create_document_drafts_entries_complete.sql"


async def create_document_drafts_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateDocumentDraftsEntriesApiResponse:
    """Internal function to create document_drafts entry."""
    tags = ["entries", "document_drafts"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateDocumentDraftsEntriesSqlParams(**request_dict)

        result = cast(
            CreateDocumentDraftsEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create document_drafts entry")

    await invalidate_tags(tags)

    return CreateDocumentDraftsEntriesApiResponse.model_validate(result.model_dump())
