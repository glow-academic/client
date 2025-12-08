"""Route tests for POST /api/v3/keys/list endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_list_keys(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting keys list with mappings."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/keys/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert "keys" in data
    assert "department_options" in data
    assert "type_options" in data
    assert "model_options" in data
    assert "department_mapping" in data
    assert "model_mapping" in data
    assert isinstance(data["keys"], list)
    assert isinstance(data["department_options"], list)
    assert isinstance(data["type_options"], list)
    assert isinstance(data["model_options"], list)
    assert isinstance(data["department_mapping"], dict)
    assert isinstance(data["model_mapping"], dict)

    # If keys exist, verify structure
    if data["keys"]:
        key = data["keys"][0]
        assert "key_id" in key
        assert "name" in key
        assert "key_masked" in key
        assert "type" in key
        assert "active" in key
        assert "department_ids" in key
        assert "model_ids" in key
        assert "can_edit" in key
        assert "can_delete" in key
        assert "can_duplicate" in key
        assert isinstance(key["model_ids"], list)


async def test_list_keys_empty(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting keys list when no keys exist."""
    profile_id = await get_superadmin_alias(db)

    # Delete all keys first
    await db.execute("DELETE FROM keys")

    response = await client.post(
        "/api/v3/keys/list",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["keys"] == []
    assert isinstance(data["department_options"], list)
    assert isinstance(data["type_options"], list)
    assert isinstance(data["model_options"], list)
