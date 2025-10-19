"""
Tests for document_service - list methods.
"""

import asyncpg
import pytest
from app.schemas.documents import (DocumentDetailBulkRequest,
                                   DocumentDetailRequest, DocumentsFilters)
from app.services.document_service import DocumentService

# --- Helper Functions ---


async def get_test_dept_id(db: asyncpg.Connection) -> str:
    """Get a test department ID from the database."""
    result = await db.fetchrow("SELECT id FROM departments WHERE active = true LIMIT 1")
    if not result:
        raise ValueError("No departments found in test database")
    return str(result['id'])


async def get_test_profile_id(db: asyncpg.Connection) -> str:
    """Get a test profile ID from the database."""
    result = await db.fetchrow("SELECT id FROM profiles LIMIT 1")
    if not result:
        raise ValueError("No profiles found in test database")
    return str(result['id'])


# --- Tests ---


@pytest.mark.asyncio
async def test_get_documents_list(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting documents list with embedded mappings."""
    # Setup - Get test data IDs
    dept_id = await get_test_dept_id(db)
    profile_id = await get_test_profile_id(db)

    # Create filters
    filters = DocumentsFilters(
        departmentIds=[dept_id],
        profileId=profile_id
    )

    # Execute - Call the service method
    svc = DocumentService(db)
    result = await svc.get_documents_list(filters)

    # Assert - Check basic structure
    assert result is not None
    assert hasattr(result, 'documents')
    assert hasattr(result, 'scenario_mapping')
    assert hasattr(result, 'parameter_item_mapping')
    assert hasattr(result, 'department_mapping')

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
        assert hasattr(document, 'document_id')
        assert hasattr(document, 'name')
        assert hasattr(document, 'scenario_ids')
        assert hasattr(document, 'parameter_item_ids')
        assert hasattr(document, 'department_id')
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
    filters = DocumentsFilters(
        departmentIds=[],
        profileId=profile_id
    )

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
    
    document_id = str(document_result['id'])
    profile_id = await get_test_profile_id(db)

    # Create request
    request = DocumentDetailRequest(
        documentId=document_id,
        profileId=profile_id
    )

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


@pytest.mark.asyncio
async def test_get_document_detail_bulk_optimized(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting bulk document detail with all mappings in single query."""
    # Setup - Get test document IDs
    documents_result = await db.fetch("SELECT id FROM documents LIMIT 2")
    if not documents_result or len(documents_result) == 0:
        pytest.skip("No documents found in test database")
    
    document_ids = [str(row['id']) for row in documents_result]
    profile_id = await get_test_profile_id(db)

    # Create request
    request = DocumentDetailBulkRequest(
        documentIds=document_ids,
        profileId=profile_id
    )

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
