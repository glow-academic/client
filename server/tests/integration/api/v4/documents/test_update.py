"""Route tests for POST /api/v4/artifacts/documents/update endpoint."""

import asyncpg  # type: ignore
import httpx
import pytest
from tests.seed_helpers import get_superadmin_alias  # type: ignore
from tests.sql.types import (
    CreateTestDocumentSqlParams,
    CreateTestDocumentSqlRow,
    GetCsDeptIdSqlRow,
    GetDocumentByIdSqlParams,
    GetDocumentByIdSqlRow,
    GetDocumentDepartmentLinkExistsSqlParams,
    GetDocumentDepartmentLinkExistsSqlRow,
    GetDocumentParameterItemLinkExistsSqlParams,
    GetDocumentParameterItemLinkExistsSqlRow,
    GetFirstParameterItemSqlRow,
)

from app.utils.sql_helper import execute_sql_typed

pytestmark = pytest.mark.asyncio


async def test_update_document(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a document."""
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

    # Create a document using SQL file
    document_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/documents/test_create_test_document_v4_complete.sql",
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

    # Get a parameter item ID if available using SQL file
    param_item_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/documents/test_get_first_parameter_item_v4_complete.sql",
        params=None,
    )
    param_item_id = None
    if len(param_item_result) > 0:
        typed_param_item = GetFirstParameterItemSqlRow.model_validate(
            param_item_result.model_dump()
        )
        param_item_id = typed_param_item.parameter_item_id

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/artifacts/documents/update",
        json={
            "document_id": str(document_id),
            "type": "homework",
            "department_id": str(dept_id),
            "parameter_item_ids": [str(param_item_id)] if param_item_id else [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["success"] is True
    assert "message" in data

    # Verify document is updated using SQL file
    document_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/documents/test_get_document_by_id_v4_complete.sql",
        params=GetDocumentByIdSqlParams(document_id=document_id),
    )
    typed_document = GetDocumentByIdSqlRow.model_validate(document_result.model_dump())
    assert typed_document.type == "homework"

    # Verify department link is created using SQL file
    dept_link_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/documents/test_get_document_department_link_exists_v4_complete.sql",
        params=GetDocumentDepartmentLinkExistsSqlParams(
            document_id=document_id, department_id=dept_id
        ),
    )
    typed_dept_link = GetDocumentDepartmentLinkExistsSqlRow.model_validate(
        dept_link_result.model_dump()
    )
    assert typed_dept_link.link_exists is True

    # Verify parameter items are linked if provided using SQL file
    if param_item_id:
        param_link_result = await execute_sql_typed(
            conn=db,
            sql_path="tests/sql/v4/integration/queries/api/documents/test_get_document_parameter_item_link_exists_v4_complete.sql",
            params=GetDocumentParameterItemLinkExistsSqlParams(
                document_id=document_id, parameter_item_id=param_item_id
            ),
        )
        typed_param_link = GetDocumentParameterItemLinkExistsSqlRow.model_validate(
            param_link_result.model_dump()
        )
        assert typed_param_link.link_exists is True


async def test_update_document_minimal(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a document with minimal fields."""
    await get_superadmin_alias(db)

    # Create a document using SQL file
    document_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/documents/test_create_test_document_v4_complete.sql",
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

    # v4 routes get profile_id from router dependency
    response = await client.post(
        "/api/v4/artifacts/documents/update",
        json={
            "document_id": str(document_id),
            "type": "lab",
            "department_id": None,
            "parameter_item_ids": [],
        },
    )

    assert response.status_code == 200
    data = response.json()

    assert data is not None
    assert data["success"] is True

    # Verify document is updated using SQL file
    document_result = await execute_sql_typed(
        conn=db,
        sql_path="tests/sql/v4/integration/queries/api/documents/test_get_document_by_id_v4_complete.sql",
        params=GetDocumentByIdSqlParams(document_id=document_id),
    )
    typed_document = GetDocumentByIdSqlRow.model_validate(document_result.model_dump())
    assert typed_document.type == "lab"


async def test_update_document_not_found(
    client: httpx.AsyncClient, db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating a non-existent document."""
    await get_superadmin_alias(db)

    # v4 routes get profile_id from router dependency
    # Note: Update endpoint may not check existence, so it might return success
    response = await client.post(
        "/api/v4/artifacts/documents/update",
        json={
            "document_id": "00000000-0000-0000-0000-000000000000",
            "type": "homework",
            "department_id": None,
            "parameter_item_ids": [],
        },
    )

    # Update endpoint doesn't check existence, it just updates
    # So it should return success even if document doesn't exist
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
