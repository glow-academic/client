"""Route tests for POST /api/v4/documents/create endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    GetDocumentByIdSqlParams,
    GetDocumentByIdSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_create_document(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new document."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/documents/create",
        json={
            "name": "Test Document",
            "type": "homework",
            "file_path": "/test/path.pdf",
            "mime_type": "application/pdf",
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert "document_id" in data
    assert data["message"] == "Document created successfully"

    document_id = data["document_id"]

    # Verify document was created using SQL file
    document_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/documents/test_get_document_by_id_v4_complete.sql",
        params=GetDocumentByIdSqlParams(document_id=document_id),
    )
    typed_document = GetDocumentByIdSqlRow.model_validate(document_result.model_dump())
    assert typed_document.document_id == document_id
    assert typed_document.name == "Test Document"
    assert typed_document.type == "homework"
