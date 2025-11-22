"""Route tests for POST /api/v3/keys/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_delete_key(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a key."""
    profile_id = await get_superadmin_alias(db)

    # Create a key first
    key_id = await db.fetchval(
        "INSERT INTO keys(name, key, type, active) "
        "VALUES ('Test Key', 'test-key-value', 'api', true) RETURNING id"
    )

    response = await client.post(
        "/api/v3/keys/delete",
        json={"keyId": str(key_id), "profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Key deleted successfully"

    # Verify key was deleted
    key = await db.fetchrow(
        "SELECT * FROM keys WHERE id = $1", key_id
    )
    assert key is None

    # Verify department links were cascade deleted
    dept_links = await db.fetch(
        "SELECT * FROM key_departments WHERE key_id = $1", key_id
    )
    assert len(dept_links) == 0


async def test_delete_key_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent key."""
    profile_id = await get_superadmin_alias(db)
    fake_key_id = "00000000-0000-0000-0000-000000000000"

    response = await client.post(
        "/api/v3/keys/delete",
        json={"keyId": fake_key_id, "profileId": profile_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()

