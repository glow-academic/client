"""Route tests for POST /api/v3/documents/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest

pytestmark = pytest.mark.asyncio


async def test_delete_document(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a document."""
    # Create a document
    document_id = await db.fetchval(
        "INSERT INTO documents(name, type, active, file_path, mime_type, created_at, updated_at) "
        "VALUES ('Test Document', 'homework', true, '/test/path.pdf', 'application/pdf', NOW(), NOW()) RETURNING id"
    )

    response = await client.post(
        "/api/v3/documents/delete",
        json={"documentId": str(document_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["success"] is True
    assert "message" in data

    # Verify document is deleted
    exists = await db.fetchval("SELECT EXISTS(SELECT 1 FROM documents WHERE id = $1)", document_id)
    assert exists is False


async def test_delete_document_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent document."""
    response = await client.post(
        "/api/v3/documents/delete",
        json={"documentId": "00000000-0000-0000-0000-000000000000"},
    )

    # Delete endpoint doesn't check existence, it just deletes
    # So it should return success even if document doesn't exist
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

