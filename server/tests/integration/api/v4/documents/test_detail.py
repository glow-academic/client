"""Route tests for POST /api/v4/documents/detail endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateDocumentDepartmentLinkSqlParams,
    CreateTestDocumentSqlParams,
    CreateTestDocumentSqlRow,
    GetCsDeptIdSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_get_document_detail(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting document detail."""
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

    # Create a document using SQL file
    document_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/documents/test_create_test_document_v4_complete.sql",
        params=CreateTestDocumentSqlParams(
            document_name="Test Document",
            document_type="homework",
            document_active=True,
        ),
    )
    typed_document = CreateTestDocumentSqlRow.model_validate(
        document_result.model_dump()
    )
    assert typed_document.document_id is not None
    document_id = typed_document.document_id

    # Link document to department using SQL file
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/api/documents/test_create_document_department_link_v4_complete.sql",
        params=CreateDocumentDepartmentLinkSqlParams(
            document_id=document_id, department_id=dept_id
        ),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/documents/detail",
        json={"document_id": str(document_id)},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "name" in data
    assert "type" in data
    assert "active" in data
    assert "document_type_options" in data
    assert "department_ids" in data
    assert "valid_department_ids" in data
    assert "department_mapping" in data
    assert "parameter_item_ids" in data
    assert "valid_parameter_item_ids" in data
    assert "parameter_item_mapping" in data

    assert data["name"] == "Test Document"
    assert data["type"] == "homework"
    assert data["active"] is True
    assert isinstance(data["document_type_options"], list)
    assert isinstance(data["department_mapping"], dict)
    assert isinstance(data["parameter_item_mapping"], dict)


async def test_get_document_detail_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting document detail for non-existent document."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/documents/detail",
        json={"document_id": "00000000-0000-0000-0000-000000000000"},
    )

    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert "not found" in data["detail"].lower()
