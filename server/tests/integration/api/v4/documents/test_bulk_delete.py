"""Route tests for POST /api/v4/documents/bulk-delete endpoint."""

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


async def test_bulk_delete_documents(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test bulk deleting documents."""
    await get_superadmin_alias(db)

    # Create documents using SQL files
    doc1_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/documents/test_create_test_document_v4_complete.sql",
        params=CreateTestDocumentSqlParams(
            document_name="Test Document 1",
            document_type="homework",
            document_active=True,
        ),
    )
    typed_doc1 = CreateTestDocumentSqlRow.model_validate(doc1_result.model_dump())
    assert typed_doc1.document_id is not None
    doc1_id = typed_doc1.document_id

    doc2_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/documents/test_create_test_document_v4_complete.sql",
        params=CreateTestDocumentSqlParams(
            document_name="Test Document 2",
            document_type="project",
            document_active=True,
        ),
    )
    typed_doc2 = CreateTestDocumentSqlRow.model_validate(doc2_result.model_dump())
    assert typed_doc2.document_id is not None
    doc2_id = typed_doc2.document_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/documents/bulk-delete",
        json={"document_ids": [str(doc1_id), str(doc2_id)]},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["success"] is True
    assert "message" in data
    assert "2 document(s)" in data["message"]

    # Verify documents are deleted using SQL files
    exists1_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/documents/test_get_document_exists_v4_complete.sql",
        params=GetDocumentExistsSqlParams(document_id=doc1_id),
    )
    typed_exists1 = GetDocumentExistsSqlRow.model_validate(exists1_result.model_dump())
    assert typed_exists1.document_exists is False

    exists2_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/documents/test_get_document_exists_v4_complete.sql",
        params=GetDocumentExistsSqlParams(document_id=doc2_id),
    )
    typed_exists2 = GetDocumentExistsSqlRow.model_validate(exists2_result.model_dump())
    assert typed_exists2.document_exists is False


async def test_bulk_delete_documents_empty_list(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test bulk deleting with empty list."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/documents/bulk-delete",
        json={"document_ids": []},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["success"] is True
    assert "0 document(s)" in data["message"]
