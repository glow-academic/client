"""Route tests for POST /api/v4/keys/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestKeySqlParams,
    CreateTestKeySqlRow,
    GetCsDeptIdSqlParams,
    GetCsDeptIdSqlRow,
    GetKeyByIdSqlParams,
    GetKeyByIdSqlRow,
    GetKeyDepartmentLinksSqlParams,
    GetKeyDepartmentLinksSqlRow,
)
from utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_update_key(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a key with new departments."""
    await get_superadmin_alias(db)

    # Get department ID using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/helpers/test_get_cs_dept_id_v4_complete.sql",
        params=None,
    )
    typed_dept = GetCsDeptIdSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # Create a key first using SQL file
    key_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/keys/test_create_test_key_v4_complete.sql",
        params=CreateTestKeySqlParams(
            key_name="Original Key",
            key_value="original-key-value",
            key_type="api",
            key_active=True,
        ),
    )
    typed_key = CreateTestKeySqlRow.model_validate(key_result.model_dump())
    assert typed_key.key_id is not None
    key_id = typed_key.key_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/keys/update",
        json={
            "key_id": str(key_id),
            "name": "Updated Key",
            "key": "sk-updated123456",
            "active": False,
            "department_ids": [str(dept_id)],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data["success"] is True
    assert data["key_id"] == str(key_id)
    assert "key_masked" in data
    assert data["message"] == "Key updated successfully"

    # Verify key was updated using SQL file
    key_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/keys/test_get_key_by_id_v4_complete.sql",
        params=GetKeyByIdSqlParams(key_id=key_id),
    )
    typed_key = GetKeyByIdSqlRow.model_validate(key_result.model_dump())
    assert typed_key.name == "Updated Key"
    assert typed_key.active is False

    # Verify department links were updated using SQL file
    dept_links_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/keys/test_get_key_department_links_v4_complete.sql",
        params=GetKeyDepartmentLinksSqlParams(key_id=key_id),
    )
    typed_dept_links = GetKeyDepartmentLinksSqlRow.model_validate(
        dept_links_result.model_dump()
    )
    assert len(typed_dept_links) == 1
    assert typed_dept_links[0].department_id == dept_id


async def test_update_key_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent key."""
    await get_superadmin_alias(db)

    fake_key_id = "00000000-0000-0000-0000-000000000000"

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/keys/update",
        json={
            "key_id": fake_key_id,
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
