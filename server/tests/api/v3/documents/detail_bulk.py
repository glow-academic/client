"""Route tests for POST /api/v3/documents/detail-bulk endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_document_detail_bulk(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting bulk document details."""
    profile_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # Create documents
    doc1_id = await db.fetchval(
        "INSERT INTO documents(name, type, active, file_path, mime_type, created_at, updated_at) "
        "VALUES ('Test Document 1', 'homework', true, '/test/path1.pdf', 'application/pdf', NOW(), NOW()) RETURNING id"
    )
    doc2_id = await db.fetchval(
        "INSERT INTO documents(name, type, active, file_path, mime_type, created_at, updated_at) "
        "VALUES ('Test Document 2', 'homework', true, '/test/path2.pdf', 'application/pdf', NOW(), NOW()) RETURNING id"
    )

    # Link documents to department
    await db.execute(
        "INSERT INTO document_departments(document_id, department_id, active, created_at, updated_at) "
        "VALUES ($1, $2, true, NOW(), NOW())",
        doc1_id,
        dept_id,
    )
    await db.execute(
        "INSERT INTO document_departments(document_id, department_id, active, created_at, updated_at) "
        "VALUES ($1, $2, true, NOW(), NOW())",
        doc2_id,
        dept_id,
    )

    response = await client.post(
        "/api/v3/documents/detail-bulk",
        json={
            "documentIds": [str(doc1_id), str(doc2_id)],
            "profileId": profile_id,
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "document_type_options" in data
    assert "type" in data
    assert "department_ids" in data
    assert "valid_department_ids" in data
    assert "department_mapping" in data
    assert "parameter_item_ids" in data
    assert "valid_parameter_item_ids" in data
    assert "parameter_item_mapping" in data

    assert data["type"] == "homework"  # Both have same type
    assert isinstance(data["department_ids"], list)
    assert isinstance(data["department_mapping"], dict)
    assert isinstance(data["parameter_item_mapping"], dict)


async def test_get_document_detail_bulk_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting bulk document details for non-existent documents."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/documents/detail-bulk",
        json={
            "documentIds": ["00000000-0000-0000-0000-000000000000"],
            "profileId": profile_id,
        },
    )

    # The endpoint should return 404 when no documents found
    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "no documents found" in data["detail"].lower() or "not found" in data["detail"].lower()

