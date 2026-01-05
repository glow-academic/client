"""Route tests for POST /api/v4/keys/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestKeySqlParams,
    CreateTestKeySqlRow,
)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_get_key_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting key detail with all data."""
    await get_superadmin_alias(db)

    # Create a key first using SQL file
    key_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/keys/test_create_test_key_v4_complete.sql",
        params=CreateTestKeySqlParams(
            key_name="Test Key",
            key_value="test-key-value",
            key_type="api",
            key_active=True,
        ),
    )
    typed_key = CreateTestKeySqlRow.model_validate(key_result.model_dump())
    assert typed_key.key_id is not None
    key_id = typed_key.key_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/keys/detail",
        json={"key_id": str(key_id)},
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
    await get_superadmin_alias(db)
    fake_key_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/keys/detail",
        json={"key_id": fake_key_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
