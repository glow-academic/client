"""Route tests for POST /api/v3/documents/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_document_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting document detail."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # Create a document
    document_id = await db.fetchval(
        "INSERT INTO documents(name, type, active, file_path, mime_type, created_at, updated_at) "
        "VALUES ('Test Document', 'homework', true, '/test/path.pdf', 'application/pdf', NOW(), NOW()) RETURNING id"
    )

    # Link document to department
    await db.execute(
        "INSERT INTO document_departments(document_id, department_id, active, created_at, updated_at) "
        "VALUES ($1, $2, true, NOW(), NOW())",
        document_id,
        dept_id,
    )

    response = await client.post(
        "/api/v3/documents/detail",
        json={
            "documentId": str(document_id),
            "profileId": profile_id,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "name" in data
    assert "type" in data
    assert "active" in data
    assert "document_type_options" in data
    assert "department_ids" in data
    assert "valid_department_ids" in data
    assert "department_mapping" in data
    assert "parameter_item_ids" in data
    assert "valid_parameter_item_ids" in data
    assert "parameter_item_mapping" in data

    assert data["name"] == "Test Document"
    assert data["type"] == "homework"
    assert data["active"] is True
    assert isinstance(data["document_type_options"], list)
    assert isinstance(data["department_mapping"], dict)
    assert isinstance(data["parameter_item_mapping"], dict)


async def test_get_document_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting document detail for non-existent document."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/documents/detail",
        json={
            "documentId": "00000000-0000-0000-0000-000000000000",
            "profileId": profile_id,
        },
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()

