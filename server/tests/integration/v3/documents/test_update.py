"""Route tests for POST /api/v3/documents/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_update_document(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a document."""
    dept_id = await get_cs_dept_id(db)

    # Create a document
    document_id = await db.fetchval(
        "INSERT INTO documents(name, type, active, file_path, mime_type, created_at, updated_at) "
        "VALUES ('Test Document', 'homework', true, '/test/path.pdf', 'application/pdf', NOW(), NOW()) RETURNING id"
    )

    # Get a parameter item ID if available
    param_item_id = await db.fetchval("SELECT id FROM parameter_items LIMIT 1")

    response = await client.post(
        "/api/v3/documents/update",
        json={
            "documentId": str(document_id),
            "type": "homework",
            "department_id": str(dept_id),
            "parameter_item_ids": [str(param_item_id)] if param_item_id else [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["success"] is True
    assert "message" in data

    # Verify document is updated
    doc = await db.fetchrow("SELECT type FROM documents WHERE id = $1", document_id)
    assert doc is not None
    assert doc["type"] == "homework"

    # Verify department link is created
    link_exists = await db.fetchval(
        "SELECT EXISTS(SELECT 1 FROM document_departments WHERE document_id = $1 AND department_id = $2 AND active = true)",
        document_id,
        dept_id,
    )
    assert link_exists is True

    # Verify parameter items are linked if provided
    if param_item_id:
        link_exists = await db.fetchval(
            "SELECT EXISTS(SELECT 1 FROM document_parameter_items WHERE document_id = $1 AND parameter_item_id = $2 AND active = true)",
            document_id,
            param_item_id,
        )
        assert link_exists is True


async def test_update_document_minimal(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a document with minimal fields."""
    # Create a document
    document_id = await db.fetchval(
        "INSERT INTO documents(name, type, active, file_path, mime_type, created_at, updated_at) "
        "VALUES ('Test Document', 'homework', true, '/test/path.pdf', 'application/pdf', NOW(), NOW()) RETURNING id"
    )

    response = await client.post(
        "/api/v3/documents/update",
        json={
            "documentId": str(document_id),
            "type": "lab",
            "department_id": None,
            "parameter_item_ids": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["success"] is True

    # Verify document is updated
    doc = await db.fetchrow("SELECT type FROM documents WHERE id = $1", document_id)
    assert doc is not None
    assert doc["type"] == "lab"


async def test_update_document_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent document."""
    response = await client.post(
        "/api/v3/documents/update",
        json={
            "documentId": "00000000-0000-0000-0000-000000000000",
            "type": "homework",
            "department_id": None,
            "parameter_item_ids": [],
        },
    )

    # Update endpoint doesn't check existence, it just updates
    # So it should return success even if document doesn't exist
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True

