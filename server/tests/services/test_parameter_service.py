"""
Tests for parameter_service - list methods.
"""

import asyncpg  # type: ignore
import pytest
from app.schemas.parameters import ParameterDetailRequest  # type: ignore
from app.schemas.parameters import ParametersFilters  # type: ignore
from app.services.parameter_service import ParameterService  # type: ignore

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


@pytest.mark.asyncio
async def test_get_parameter_detail_optimized(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting parameter detail with all mappings in single query."""
    # Setup - Get test parameter and profile IDs
    parameter_result = await db.fetchrow("SELECT id FROM parameters LIMIT 1")
    if not parameter_result:
        pytest.skip("No parameters found in test database")
    
    parameter_id = str(parameter_result['id'])
    profile_id = await get_test_profile_id(db)

    # Create request
    request = ParameterDetailRequest(
        parameterId=parameter_id,
        profileId=profile_id
    )

    # Execute - Call the service method
    svc = ParameterService(db)
    result = await svc.get_parameter_detail(request)

    # Assert - Check basic structure
    assert result is not None
    assert result.name is not None
    assert result.description is not None
    
    # Check mappings exist
    assert result.department_mapping is not None
    assert isinstance(result.department_mapping, dict)
    
    # Check valid IDs lists
    assert result.valid_department_ids is not None
    assert isinstance(result.valid_department_ids, list)
    
    # CRITICAL: Verify department_mapping is populated when department_id exists
    if result.department_id:
        assert len(result.department_mapping) > 0, "department_mapping should be populated when parameter has department"
        assert result.department_id in result.department_mapping, f"Department {result.department_id} should be in department_mapping"
        dept_item = result.department_mapping[result.department_id]
        assert hasattr(dept_item, 'name') and len(dept_item.name) > 0, "Department mapping should have valid name"
        assert hasattr(dept_item, 'description'), "Department mapping should have description field"
    
    # Check parameter items
    assert result.parameter_items is not None
    assert isinstance(result.parameter_items, list)
    
    # If items exist, check their structure and can_delete field
    if result.parameter_items:
        item = result.parameter_items[0]
        assert hasattr(item, 'parameter_item_id')
        assert hasattr(item, 'name')
        assert hasattr(item, 'can_delete')
        assert isinstance(item.can_delete, bool)


@pytest.mark.asyncio
async def test_get_parameter_detail_not_found(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting parameter detail with invalid ID raises error."""
    # Setup
    profile_id = await get_test_profile_id(db)
    
    # Create request with non-existent parameter ID
    request = ParameterDetailRequest(
        parameterId="00000000-0000-0000-0000-000000000000",
        profileId=profile_id
    )

    # Execute & Assert - Should raise ValueError
    svc = ParameterService(db)
    with pytest.raises(ValueError, match="Parameter not found"):
        await svc.get_parameter_detail(request)
