"""Route tests for POST /api/v4/documents/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_list_documents(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting documents list with mappings."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/documents/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "documents" in data
    assert "scenario_mapping" in data
    assert "parameter_item_mapping" in data
    assert "department_mapping" in data
    assert "parameter_mapping" in data
    assert isinstance(data["documents"], list)
    assert isinstance(data["scenario_mapping"], dict)
    assert isinstance(data["parameter_item_mapping"], dict)
    assert isinstance(data["department_mapping"], dict)
    assert isinstance(data["parameter_mapping"], dict)

    # If there are documents, verify structure
    if data["documents"]:
        for doc in data["documents"]:
            assert "document_id" in doc
            assert "name" in doc
            assert "type" in doc
            assert "updated_at" in doc
            assert "active" in doc
            assert "scenario_ids" in doc
            assert "parameter_item_ids" in doc
            assert "can_edit" in doc
            assert "can_delete" in doc


async def test_list_documents_empty(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test documents list works even with no documents."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/documents/list",
        json={},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "documents" in data
    assert isinstance(data["documents"], list)

