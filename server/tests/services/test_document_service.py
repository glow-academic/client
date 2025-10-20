"""
Tests for document_service - list methods.
"""

import asyncpg  # type: ignore
import pytest

from app.schemas.documents import (
    DocumentDetailBulkRequest,  # type: ignore
    DocumentDetailRequest,  # type: ignore
    DocumentsFilters,  # type: ignore
)
from app.services.document_service import DocumentService  # type: ignore

# --- Helper Functions ---


async def get_test_dept_id(db: asyncpg.Connection) -> str:
    """Get a test department ID from the database."""
    result = await db.fetchrow("SELECT id FROM departments WHERE active = true LIMIT 1")
    if not result:
        raise ValueError("No departments found in test database")
    return str(result["id"])


async def get_test_profile_id(db: asyncpg.Connection) -> str:
    """Get a test profile ID from the database."""
    result = await db.fetchrow("SELECT id FROM profiles LIMIT 1")
    if not result:
        raise ValueError("No profiles found in test database")
    return str(result["id"])


# --- Tests ---


@pytest.mark.asyncio
async def test_get_documents_list(db: asyncpg.Connection, disable_cache: None) -> None:
    """Test getting documents list with embedded mappings."""
    # Setup - Get test data IDs
    dept_id = await get_test_dept_id(db)
    profile_id = await get_test_profile_id(db)

    # Create filters
    filters = DocumentsFilters(departmentIds=[dept_id], profileId=profile_id)

    # Execute - Call the service method
    svc = DocumentService(db)
    result = await svc.get_documents_list(filters)

    # Assert - Check basic structure
    assert result is not None
    assert hasattr(result, "documents")
    assert hasattr(result, "scenario_mapping")
    assert hasattr(result, "parameter_item_mapping")
    assert hasattr(result, "department_mapping")

    # Check that documents is a list (could be empty)
    assert isinstance(result.documents, list)
    assert len(result.documents) >= 0

    # Check that mappings are dicts (could be empty)
    assert isinstance(result.scenario_mapping, dict)
    assert isinstance(result.parameter_item_mapping, dict)
    assert isinstance(result.department_mapping, dict)

    # If documents exist, check basic fields
    if result.documents:
        document = result.documents[0]
        assert hasattr(document, "document_id")
        assert hasattr(document, "name")
        assert hasattr(document, "scenario_ids")
        assert hasattr(document, "parameter_item_ids")
        assert hasattr(document, "department_id")
        assert isinstance(document.scenario_ids, list)
        assert isinstance(document.parameter_item_ids, list)


@pytest.mark.asyncio
async def test_get_documents_list_empty_departments(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting documents list with no departments returns empty list."""
    # Setup
    profile_id = await get_test_profile_id(db)

    # Create filters with empty department list
    filters = DocumentsFilters(departmentIds=[], profileId=profile_id)

    # Execute
    svc = DocumentService(db)
    result = await svc.get_documents_list(filters)

    # Assert - Should return empty list but valid structure
    assert result is not None
    assert isinstance(result.documents, list)
    assert len(result.documents) == 0
    assert isinstance(result.scenario_mapping, dict)
    assert isinstance(result.parameter_item_mapping, dict)
    assert isinstance(result.department_mapping, dict)


@pytest.mark.asyncio
async def test_get_document_detail_optimized(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting document detail with all mappings in single query."""
    # Setup - Get test document and profile IDs
    document_result = await db.fetchrow("SELECT id FROM documents LIMIT 1")
    if not document_result:
        pytest.skip("No documents found in test database")

    document_id = str(document_result["id"])
    profile_id = await get_test_profile_id(db)

    # Create request
    request = DocumentDetailRequest(documentId=document_id, profileId=profile_id)

    # Execute - Call the service method
    svc = DocumentService(db)
    result = await svc.get_document_detail(request)

    # Assert - Check basic structure
    assert result is not None
    assert result.name is not None
    assert result.type is not None

    # Check mappings exist
    assert result.department_mapping is not None
    assert isinstance(result.department_mapping, dict)
    assert result.parameter_item_mapping is not None
    assert isinstance(result.parameter_item_mapping, dict)

    # Check valid IDs lists
    assert result.valid_department_ids is not None
    assert isinstance(result.valid_department_ids, list)
    assert result.valid_parameter_item_ids is not None
    assert isinstance(result.valid_parameter_item_ids, list)

    # CRITICAL: Verify department_mapping is populated when department_id exists
    if result.department_id:
        assert len(result.department_mapping) > 0, (
            "department_mapping should be populated when document has department"
        )
        assert result.department_id in result.department_mapping, (
            f"Department {result.department_id} should be in department_mapping"
        )
        dept_item = result.department_mapping[result.department_id]
        assert hasattr(dept_item, "name") and len(dept_item.name) > 0, (
            "Department mapping should have valid name"
        )
        assert hasattr(dept_item, "description"), (
            "Department mapping should have description field"
        )


@pytest.mark.asyncio
async def test_get_document_detail_bulk_optimized(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting bulk document detail with all mappings in single query."""
    # Setup - Get test document IDs
    documents_result = await db.fetch("SELECT id FROM documents LIMIT 2")
    if not documents_result or len(documents_result) == 0:
        pytest.skip("No documents found in test database")

    document_ids = [str(row["id"]) for row in documents_result]
    profile_id = await get_test_profile_id(db)

    # Create request
    request = DocumentDetailBulkRequest(documentIds=document_ids, profileId=profile_id)

    # Execute - Call the service method
    svc = DocumentService(db)
    result = await svc.get_document_detail_bulk(request)

    # Assert - Check basic structure
    assert result is not None
    assert result.department_ids is not None
    assert isinstance(result.department_ids, list)

    # Check mappings exist
    assert result.department_mapping is not None
    assert isinstance(result.department_mapping, dict)
    assert result.parameter_item_mapping is not None
    assert isinstance(result.parameter_item_mapping, dict)

    # Check valid IDs lists
    assert result.valid_department_ids is not None
    assert isinstance(result.valid_department_ids, list)
    assert result.valid_parameter_item_ids is not None
    assert isinstance(result.valid_parameter_item_ids, list)

    # CRITICAL: Verify department_mapping is populated when department_ids exist
    if len(result.department_ids) > 0:
        assert len(result.department_mapping) > 0, (
            "department_mapping should be populated when documents have departments"
        )
        first_dept_id = result.department_ids[0]
        assert first_dept_id in result.department_mapping, (
            f"Department {first_dept_id} should be in department_mapping"
        )
        dept_item = result.department_mapping[first_dept_id]
        assert hasattr(dept_item, "name") and len(dept_item.name) > 0, (
            "Department mapping should have valid name"
        )
        assert hasattr(dept_item, "description"), (
            "Department mapping should have description field"
        )


@pytest.mark.asyncio
async def test_documents_only_return_root_scenarios(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that documents list only returns root scenarios in scenario_ids."""
    # Setup
    dept_id = await get_test_dept_id(db)
    profile_id = await get_test_profile_id(db)

    # Execute
    svc = DocumentService(db)
    filters = DocumentsFilters(departmentIds=[dept_id], profileId=profile_id)
    result = await svc.get_documents_list(filters)

    # Assert - Check that all scenario_ids are root scenarios
    for document in result.documents:
        for scenario_id in document.scenario_ids:
            # Verify each scenario is a root (parent_id = child_id in scenario_tree)
            is_root = await db.fetchval(
                """
                SELECT EXISTS(
                    SELECT 1 FROM scenario_tree 
                    WHERE parent_id = $1 AND child_id = $1
                )
            """,
                scenario_id,
            )

            assert is_root, (
                f"Document {document.name} has scenario {scenario_id} which is not a root scenario"
            )


@pytest.mark.asyncio
async def test_document_can_edit_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test can_edit permission logic for documents based on active scenario links."""
    # Setup - Get test data
    dept_result = await db.fetchrow(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    if not dept_result:
        pytest.skip("No departments found")

    dept_id = str(dept_result["id"])

    # Get admin profiles (admin and superadmin)
    admin_result = await db.fetchrow(
        "SELECT id FROM profiles WHERE role IN ('admin', 'instructional') LIMIT 1"
    )

    if not admin_result:
        pytest.skip("Need admin/instructional profile")

    admin_id = str(admin_result["id"])

    # Execute
    from app.schemas.documents import DocumentsFilters

    svc = DocumentService(db)
    resp_admin = await svc.get_documents_list(
        DocumentsFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    # Test rules:
    # 1. Documents with active scenario links: cannot edit
    # 2. Other documents: instructional, admin, superadmin can edit

    for document in resp_admin.documents:
        # Get active scenario link counts from database
        active_scenario_count = await db.fetchval(
            """
            SELECT COUNT(*) FROM scenario_documents 
            WHERE document_id = $1 AND active = true
        """,
            document.document_id,
        )

        # Rule 1: Documents with active scenario links - nobody can edit
        if active_scenario_count > 0:
            assert document.can_edit == False, (
                f"Document {document.name} with {active_scenario_count} active scenario links should not be editable"
            )

        # Rule 2: Documents without active scenario links - admin can edit
        else:
            assert document.can_edit == True, (
                f"Admin should be able to edit document {document.name} without active scenario links"
            )


@pytest.mark.asyncio
async def test_document_can_delete_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test can_delete permission logic for documents based on all scenario links."""
    # Setup - Get test data
    dept_result = await db.fetchrow(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    if not dept_result:
        pytest.skip("No departments found")

    dept_id = str(dept_result["id"])

    # Get admin profile
    admin_result = await db.fetchrow(
        "SELECT id FROM profiles WHERE role IN ('admin', 'instructional') LIMIT 1"
    )

    if not admin_result:
        pytest.skip("Need admin/instructional profile")

    admin_id = str(admin_result["id"])

    # Execute
    from app.schemas.documents import DocumentsFilters

    svc = DocumentService(db)
    resp_admin = await svc.get_documents_list(
        DocumentsFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    # Test rules:
    # 1. Documents with ANY scenario links (active or inactive): cannot delete
    # 2. Other documents: instructional, admin, superadmin can delete

    for document in resp_admin.documents:
        # Get total scenario link count from database
        total_scenario_links = await db.fetchval(
            """
            SELECT COUNT(*) FROM scenario_documents 
            WHERE document_id = $1
        """,
            document.document_id,
        )

        # Rule 1: Documents with any scenario links - nobody can delete
        if total_scenario_links > 0:
            assert document.can_delete == False, (
                f"Document {document.name} with {total_scenario_links} scenario links should not be deletable"
            )

        # Rule 2: Unlinked documents - admin can delete
        else:
            assert document.can_delete == True, (
                f"Admin should be able to delete unlinked document {document.name}"
            )
