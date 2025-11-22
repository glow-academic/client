"""Route tests for POST /api/v3/keys/detail-default endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


async def test_get_key_detail_default(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default key detail for new key creation."""
    profile_id = await get_superadmin_alias(db)

    response = await client.post(
        "/api/v3/keys/detail-default",
        json={"profileId": profile_id},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "key_id" in data
    assert "name" in data
    assert "key_masked" in data
    assert "type" in data
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

