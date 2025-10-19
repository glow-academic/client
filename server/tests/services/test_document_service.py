"""
Tests for document_service - list methods.
"""

import asyncpg
import pytest
from app.schemas.documents import DocumentsFilters
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
