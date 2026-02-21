"""Certificates entry CREATE endpoint."""

from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    CreateCertificatesEntriesApiResponse,
    CreateCertificatesEntriesSqlParams,
    CreateCertificatesEntriesSqlRow,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/entries/certificates/create_certificates_entries_complete.sql"
)


async def create_certificates_entry_internal(
    conn: asyncpg.Connection,
    request_dict: dict,
    mcp: bool = False,
) -> CreateCertificatesEntriesApiResponse:
    """Internal function to create certificates entry."""
    tags = ["entries", "certificates"]

    async with conn.transaction():
        request_dict["mcp"] = mcp
        params = CreateCertificatesEntriesSqlParams(**request_dict)

        result = cast(
            CreateCertificatesEntriesSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result or not result.id:
            raise ValueError("Failed to create certificates entry")

    await invalidate_tags(tags)

    return CreateCertificatesEntriesApiResponse.model_validate(result.model_dump())
