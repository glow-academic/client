"""Route tests for POST /api/v4/keys/decrypt endpoint."""

import uuid

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestKeySqlParams,
    CreateTestKeySqlRow,
    GetKeyByIdSqlParams,
    GetKeyByIdSqlRow,
)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_decrypt_key(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test decrypting a valid key."""
    await get_superadmin_alias(db)

    # Create a key first using SQL file
    key_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/keys/test_create_test_key_v4_complete.sql",
        params=CreateTestKeySqlParams(
            key_name="Test Decrypt Key",
            key_value="sk-test-decrypt-value-12345",
            key_type="api",
            key_active=True,
        ),
    )
    typed_key = CreateTestKeySqlRow.model_validate(key_result.model_dump())
    assert typed_key.key_id is not None
    key_id = typed_key.key_id

    # Verify key was created using SQL file
    key_verify_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/keys/test_get_key_by_id_v4_complete.sql",
        params=GetKeyByIdSqlParams(key_id=key_id),
    )
    typed_key_verify = GetKeyByIdSqlRow.model_validate(key_verify_result.model_dump())
    assert typed_key_verify.key_id == key_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/keys/decrypt",
        json={"key_id": str(key_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "key" in data
    # Decrypted key should match the original value (before encryption)
    assert data["key"] == "sk-test-decrypt-value-12345"


async def test_decrypt_key_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test decrypting a non-existent key."""
    await get_superadmin_alias(db)

    # Use a non-existent UUID
    fake_key_id = uuid.uuid4()

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/keys/decrypt",
        json={"key_id": str(fake_key_id)},
    )

    assert response.status_code == 400
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower() or "key" in data["detail"].lower()

