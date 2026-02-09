"""Route tests for POST /api/v4/artifacts/documents/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestDocumentSqlParams,
    CreateTestDocumentSqlRow,
    GetDocumentExistsSqlParams,
    GetDocumentExistsSqlRow,
)

from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_delete_document(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a document."""
    await get_superadmin_alias(db)

    # Create a document using SQL file
    document_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/documents/test_create_test_document_v4_complete.sql",
        params=CreateTestDocumentSqlParams(
            document_name="Test Document",
            document_type="homework",
            document_active=True,
        ),
    )
    typed_document = CreateTestDocumentSqlRow.model_validate(
        document_result.model_dump()
    )
    assert typed_document.document_id is not None
    document_id = typed_document.document_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/artifacts/documents/delete",
        json={"document_id": str(document_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["success"] is True
    assert "message" in data

    # Verify document is deleted using SQL file
    exists_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/documents/test_get_document_exists_v4_complete.sql",
        params=GetDocumentExistsSqlParams(document_id=document_id),
    )
    typed_exists = GetDocumentExistsSqlRow.model_validate(exists_result.model_dump())
    assert typed_exists.document_exists is False


async def test_delete_document_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent document."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    # Note: Delete endpoint may not check existence, so it might return success
    response = await client.post(
        "/api/v4/artifacts/documents/delete",
        json={"document_id": "00000000-0000-0000-0000-000000000000"},
    )

    # Delete endpoint doesn't check existence, it just deletes
    # So it should return success even if document doesn't exist
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
