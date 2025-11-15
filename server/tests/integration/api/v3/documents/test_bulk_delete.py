"""Route tests for POST /api/v3/documents/bulk-delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest

pytestmark = pytest.mark.asyncio


async def test_bulk_delete_documents(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test bulk deleting documents."""
    # Create documents
    doc1_id = await db.fetchval(
        "INSERT INTO documents(name, type, active, file_path, mime_type, created_at, updated_at) "
        "VALUES ('Test Document 1', 'homework', true, '/test/path1.pdf', 'application/pdf', NOW(), NOW()) RETURNING id"
    )
    doc2_id = await db.fetchval(
        "INSERT INTO documents(name, type, active, file_path, mime_type, created_at, updated_at) "
        "VALUES ('Test Document 2', 'project', true, '/test/path2.pdf', 'application/pdf', NOW(), NOW()) RETURNING id"
    )

    response = await client.post(
        "/api/v3/documents/bulk-delete",
        json={"documentIds": [str(doc1_id), str(doc2_id)]},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["success"] is True
    assert "message" in data
    assert "2 document(s)" in data["message"]

    # Verify documents are deleted
    exists1 = await db.fetchval("SELECT EXISTS(SELECT 1 FROM documents WHERE id = $1)", doc1_id)
    exists2 = await db.fetchval("SELECT EXISTS(SELECT 1 FROM documents WHERE id = $1)", doc2_id)
    assert exists1 is False
    assert exists2 is False


async def test_bulk_delete_documents_empty_list(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test bulk deleting with empty list."""
    response = await client.post(
        "/api/v3/documents/bulk-delete",
        json={"documentIds": []},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["success"] is True
    assert "0 document(s)" in data["message"]

