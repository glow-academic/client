"""
Tests for rubric_service - list methods.
"""

import asyncpg
import pytest
from app.schemas.rubrics import RubricsFilters
from app.services.rubric_service import RubricService

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
async def test_get_rubrics_list(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting rubrics list with embedded hierarchical structure."""
    # Setup - Get test data IDs
    dept_id = await get_test_dept_id(db)
    profile_id = await get_test_profile_id(db)

    # Create filters
    filters = RubricsFilters(
        departmentIds=[dept_id],
        profileId=profile_id
    )

    # Execute - Call the service method
    svc = RubricService(db)
    result = await svc.get_rubrics_list(filters)

    # Assert - Check basic structure
    assert result is not None
    assert hasattr(result, 'rubrics')
    assert hasattr(result, 'standard_groups_mapping')
    assert hasattr(result, 'standards_mapping')

    # Check that rubrics is a list (could be empty)
    assert isinstance(result.rubrics, list)
    assert len(result.rubrics) >= 0

    # Check that mappings are dicts (could be empty)
    assert isinstance(result.standard_groups_mapping, dict)
    assert isinstance(result.standards_mapping, dict)

    # If rubrics exist, check hierarchical structure
    if result.rubrics:
        rubric = result.rubrics[0]
        assert hasattr(rubric, 'rubric_id')
        assert hasattr(rubric, 'name')
        assert hasattr(rubric, 'standard_groups')
        assert isinstance(rubric.standard_groups, dict)


@pytest.mark.asyncio
async def test_get_rubrics_list_empty_departments(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting rubrics list with no departments returns empty list."""
    # Setup
    profile_id = await get_test_profile_id(db)

    # Create filters with empty department list
    filters = RubricsFilters(
        departmentIds=[],
        profileId=profile_id
    )

    # Execute
    svc = RubricService(db)
    result = await svc.get_rubrics_list(filters)

    # Assert - Should return empty list but valid structure
    assert result is not None
    assert isinstance(result.rubrics, list)
    assert len(result.rubrics) == 0
    assert isinstance(result.standard_groups_mapping, dict)
    assert isinstance(result.standards_mapping, dict)
