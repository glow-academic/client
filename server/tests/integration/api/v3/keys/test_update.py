"""Route tests for POST /api/v3/keys/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias  # type: ignore
from utils.auth.encrypt_api_key import encrypt_api_key

pytestmark = pytest.mark.asyncio


async def test_update_key(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a key with new departments."""
    await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    # Create a key first
    encrypted_key = encrypt_api_key("original-key-value")
    key_id = await db.fetchval(
        "INSERT INTO keys(name, key, type, active) "
        "VALUES ('Original Key', $1, 'api', true) RETURNING id",
        encrypted_key,
    )

    response = await client.post(
        "/api/v3/keys/update",
        json={
            "keyId": str(key_id),
            "name": "Updated Key",
            "key": "sk-updated123456",
            "active": False,
            "department_ids": [str(dept_id)],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["keyId"] == str(key_id)
    assert "key_masked" in data
    assert data["message"] == "Key updated successfully"

    # Verify key was updated
    key = await db.fetchrow("SELECT * FROM keys WHERE id = $1", key_id)
    assert key is not None
    assert key["name"] == "Updated Key"
    assert key["active"] is False

    # Verify department links were updated
    dept_links = await db.fetch(
        "SELECT * FROM key_departments WHERE key_id = $1 AND active = true",
        key_id,
    )
    assert len(dept_links) == 1
    assert str(dept_links[0]["department_id"]) == str(dept_id)


async def test_update_key_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent key."""
    fake_key_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/keys/update",
        json={
            "keyId": fake_key_id,
            "name": "Updated Key",
            "key": "sk-updated",
            "active": True,
            "department_ids": None,
        },
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
