"""
Tests for parameter_service - list methods.
"""

import asyncpg
import pytest
from app.schemas.parameters import ParametersFilters
from app.services.parameter_service import ParameterService

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
async def test_get_parameters_list(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting parameters list (already optimized)."""
    # Setup - Get test data IDs
    dept_id = await get_test_dept_id(db)
    profile_id = await get_test_profile_id(db)

    # Create filters
    filters = ParametersFilters(
        departmentIds=[dept_id],
        profileId=profile_id
    )

    # Execute - Call the service method
    svc = ParameterService(db)
    result = await svc.get_parameters_list(filters)

    # Assert - Check basic structure
    assert result is not None
    assert hasattr(result, 'parameters')

    # Check that parameters is a list (could be empty)
    assert isinstance(result.parameters, list)
    assert len(result.parameters) >= 0

    # If parameters exist, check basic fields
    if result.parameters:
        parameter = result.parameters[0]
        assert hasattr(parameter, 'parameter_id')
        assert hasattr(parameter, 'name')
        assert hasattr(parameter, 'num_items')
        assert hasattr(parameter, 'can_edit')
        assert hasattr(parameter, 'can_delete')


@pytest.mark.asyncio
async def test_get_parameters_list_empty_departments(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting parameters list with no departments returns empty list."""
    # Setup
    profile_id = await get_test_profile_id(db)

    # Create filters with empty department list
    filters = ParametersFilters(
        departmentIds=[],
        profileId=profile_id
    )

    # Execute
    svc = ParameterService(db)
    result = await svc.get_parameters_list(filters)

    # Assert - Should return empty list but valid structure
    assert result is not None
    assert isinstance(result.parameters, list)
    assert len(result.parameters) == 0
