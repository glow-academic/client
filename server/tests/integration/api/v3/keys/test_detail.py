"""Route tests for POST /api/v3/keys/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_key_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting key detail with all data."""
    profile_id = await get_superadmin_alias(db)

    # Create a key first
    key_id = await db.fetchval(
        "INSERT INTO keys(name, key, type, active) "
        "VALUES ('Test Key', 'test-key-value', 'api', true) RETURNING id"
    )

    response = await client.post(
        "/api/v3/keys/detail",
        json={"keyId": str(key_id), "profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "key_id" in data
    assert "name" in data
    assert data["name"] == "Test Key"
    assert "key_masked" in data
    assert "type" in data
    assert data["type"] == "api"
    assert "active" in data
    assert "department_ids" in data
    assert "model_ids" in data
    assert "valid_department_ids" in data
    assert "can_edit" in data
    assert "department_mapping" in data
    assert "model_mapping" in data
    assert isinstance(data["department_ids"], list)
    assert isinstance(data["model_ids"], list)
    assert isinstance(data["valid_department_ids"], list)
    assert isinstance(data["department_mapping"], dict)
    assert isinstance(data["model_mapping"], dict)


async def test_get_key_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting detail for non-existent key."""
    profile_id = await get_superadmin_alias(db)
    fake_key_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/keys/detail",
        json={"keyId": fake_key_id, "profileId": profile_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()

