"""Route tests for POST /api/v4/artifacts/documents/detail-bulk endpoint."""

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


async def test_get_document_detail_bulk(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting bulk document details."""
    await get_superadmin_alias(db)

    # Get department ID using SQL file
    dept_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/helpers/test_get_cs_dept_id_v4_complete.sql",
        params=None,
    )
    typed_dept = GetCsDeptIdSqlRow.model_validate(dept_result.model_dump())
    assert typed_dept.department_id is not None
    dept_id = typed_dept.department_id

    # Create documents using SQL files
    doc1_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/documents/test_create_test_document_v4_complete.sql",
        params=CreateTestDocumentSqlParams(
            document_name="Test Document 1",
            document_type="homework",
            document_active=True,
        ),
    )
    typed_doc1 = CreateTestDocumentSqlRow.model_validate(doc1_result.model_dump())
    assert typed_doc1.document_id is not None
    doc1_id = typed_doc1.document_id

    doc2_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/documents/test_create_test_document_v4_complete.sql",
        params=CreateTestDocumentSqlParams(
            document_name="Test Document 2",
            document_type="homework",
            document_active=True,
        ),
    )
    typed_doc2 = CreateTestDocumentSqlRow.model_validate(doc2_result.model_dump())
    assert typed_doc2.document_id is not None
    doc2_id = typed_doc2.document_id

    # Link documents to department using SQL files
    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/documents/test_create_document_department_link_v4_complete.sql",
        params=CreateDocumentDepartmentLinkSqlParams(
            document_id=doc1_id, department_id=dept_id
        ),
    )

    await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/documents/test_create_document_department_link_v4_complete.sql",
        params=CreateDocumentDepartmentLinkSqlParams(
            document_id=doc2_id, department_id=dept_id
        ),
    )

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/artifacts/documents/detail-bulk",
        json={"document_ids": [str(doc1_id), str(doc2_id)]},
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert "document_type_options" in data
    assert "type" in data
    assert "department_ids" in data
    assert "valid_department_ids" in data
    assert "department_mapping" in data
    assert "parameter_item_ids" in data
    assert "valid_parameter_item_ids" in data
    assert "parameter_item_mapping" in data

    assert data["type"] == "homework"  # Both have same type
    assert isinstance(data["department_ids"], list)
    assert isinstance(data["department_mapping"], dict)
    assert isinstance(data["parameter_item_mapping"], dict)


async def test_get_document_detail_bulk_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting bulk document details for non-existent documents."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/artifacts/documents/detail-bulk",
        json={"document_ids": ["00000000-0000-0000-0000-000000000000"]},
    )

    # The endpoint should return 404 when no documents found
    assert response.status_code == 404
    data = response.json()
    assert "detail" in data
    assert (
        "no documents found" in data["detail"].lower()
        or "not found" in data["detail"].lower()
    )
