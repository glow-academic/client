"""
Tests for rubric_service - list methods.
"""

import asyncpg
import pytest
from app.schemas.rubrics import RubricDetailRequest, RubricsFilters
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


@pytest.mark.asyncio
async def test_get_rubric_detail_optimized(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting rubric detail with hierarchical structure in single query."""
    # Setup - Get test rubric and profile IDs
    rubric_result = await db.fetchrow("SELECT id FROM rubrics LIMIT 1")
    if not rubric_result:
        pytest.skip("No rubrics found in test database")
    
    rubric_id = str(rubric_result['id'])
    profile_id = await get_test_profile_id(db)

    # Create request
    request = RubricDetailRequest(
        rubricId=rubric_id,
        profileId=profile_id
    )

    # Execute - Call the service method
    svc = RubricService(db)
    result = await svc.get_rubric_detail(request)

    # Assert - Check basic structure
    assert result is not None
    assert result.name is not None
    assert result.description is not None
    
    # Check mappings exist
    assert result.department_mapping is not None
    assert isinstance(result.department_mapping, dict)
    assert result.standard_groups_mapping is not None
    assert isinstance(result.standard_groups_mapping, dict)
    assert result.standards_mapping is not None
    assert isinstance(result.standards_mapping, dict)
    
    # Check hierarchical structure
    assert result.standard_group_ids is not None
    assert isinstance(result.standard_group_ids, list)
    assert result.standard_groups_detail is not None
    assert isinstance(result.standard_groups_detail, dict)
    
    # Check valid IDs lists
    assert result.valid_department_ids is not None
    assert isinstance(result.valid_department_ids, list)
    
    # Check permission flags
    assert isinstance(result.can_edit, bool)


@pytest.mark.asyncio
async def test_get_rubric_detail_not_found(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting rubric detail with invalid ID raises error."""
    # Setup
    profile_id = await get_test_profile_id(db)
    
    # Create request with non-existent rubric ID
    request = RubricDetailRequest(
        rubricId="00000000-0000-0000-0000-000000000000",
        profileId=profile_id
    )

    # Execute & Assert - Should raise ValueError
    svc = RubricService(db)
    with pytest.raises(ValueError, match="Rubric not found"):
        await svc.get_rubric_detail(request)
