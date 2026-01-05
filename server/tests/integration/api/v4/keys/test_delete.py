"""Route tests for POST /api/v4/keys/delete endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestKeySqlParams,
    CreateTestKeySqlRow,
    GetKeyByIdSqlParams,
    GetKeyDepartmentLinksSqlParams,
    GetKeyDepartmentLinksSqlRow,
)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_delete_key(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a key."""
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
        "/api/v4/keys/delete",
        json={"key_id": str(key_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["message"] == "Key deleted successfully"

    # Verify key was deleted using SQL file
    key_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/keys/test_get_key_by_id_v4_complete.sql",
        params=GetKeyByIdSqlParams(key_id=key_id),
    )
    # Should return empty result
    assert len(key_result) == 0

    # Verify department links were cascade deleted using SQL file
    dept_links_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/keys/test_get_key_department_links_v4_complete.sql",
        params=GetKeyDepartmentLinksSqlParams(key_id=key_id),
    )
    typed_dept_links = GetKeyDepartmentLinksSqlRow.model_validate(
        dept_links_result.model_dump()
    )
    assert len(typed_dept_links) == 0


async def test_delete_key_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a non-existent key."""
    await get_superadmin_alias(db)
    fake_key_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/keys/delete",
        json={"key_id": fake_key_id},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
