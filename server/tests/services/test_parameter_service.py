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


@pytest.mark.asyncio
async def test_parameter_can_edit_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test can_edit permission logic for parameters based on active scenario links via parameter_items."""
    # Setup - Get test data
    dept_result = await db.fetchrow("SELECT id FROM departments WHERE active = true LIMIT 1")
    if not dept_result:
        pytest.skip("No departments found")
    
    dept_id = str(dept_result["id"])
    
    # Get admin profile (only admin/superadmin have access to parameters, not instructional)
    admin_result = await db.fetchrow("SELECT id FROM profiles WHERE role IN ('admin', 'superadmin') LIMIT 1")
    
    if not admin_result:
        pytest.skip("Need admin/superadmin profile")
    
    admin_id = str(admin_result["id"])
    
    # Execute
    from app.schemas.parameters import ParametersFilters
    
    svc = ParameterService(db)
    resp_admin = await svc.get_parameters_list(
        ParametersFilters(departmentIds=[dept_id], profileId=admin_id)
    )
    
    # Test rules:
    # 1. Parameters with active scenario links (via parameter_items): cannot edit
    # 2. Default parameters: only superadmin can edit (admin cannot)
    # 3. Other parameters: admin, superadmin can edit
    
    # Check if user is admin or superadmin
    user_role = await db.fetchval("SELECT role FROM profiles WHERE id = $1", admin_id)
    
    for parameter in resp_admin.parameters:
        # Get active scenario link counts from database
        # (through parameter_items -> scenario_parameter_items)
        active_scenario_count = await db.fetchval("""
            SELECT COUNT(DISTINCT spi.scenario_id)
            FROM parameter_items pi
            JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id
            WHERE pi.parameter_id = $1 AND spi.active = true
        """, parameter.parameter_id)
        
        # Rule 1: Parameters with active scenario links - nobody can edit
        if active_scenario_count > 0:
            assert parameter.can_edit == False, \
                f"Parameter {parameter.name} with {active_scenario_count} active scenario links should not be editable"
        
        # Rule 2: Default parameters - only superadmin can edit
        elif parameter.default_parameter:
            if user_role == 'superadmin':
                assert parameter.can_edit == True, \
                    f"Superadmin should be able to edit default parameter {parameter.name}"
            else:
                assert parameter.can_edit == False, \
                    f"Admin should NOT be able to edit default parameter {parameter.name}"
        
        # Rule 3: Non-default parameters without active scenario links - admin/superadmin can edit
        else:
            assert parameter.can_edit == True, \
                f"Admin should be able to edit non-default parameter {parameter.name} without active scenario links"


@pytest.mark.asyncio
async def test_parameter_can_delete_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test can_delete permission logic for parameters based on all scenario links via parameter_items."""
    # Setup - Get test data
    dept_result = await db.fetchrow("SELECT id FROM departments WHERE active = true LIMIT 1")
    if not dept_result:
        pytest.skip("No departments found")
    
    dept_id = str(dept_result["id"])
    
    # Get admin profile
    admin_result = await db.fetchrow("SELECT id FROM profiles WHERE role IN ('admin', 'superadmin') LIMIT 1")
    
    if not admin_result:
        pytest.skip("Need admin/superadmin profile")
    
    admin_id = str(admin_result["id"])
    
    # Execute
    from app.schemas.parameters import ParametersFilters
    
    svc = ParameterService(db)
    resp_admin = await svc.get_parameters_list(
        ParametersFilters(departmentIds=[dept_id], profileId=admin_id)
    )
    
    # Test rules:
    # 1. Parameters with ANY scenario links (via parameter_items, active or inactive): cannot delete
    # 2. Default parameters: only superadmin can delete (admin cannot)
    # 3. Other parameters: admin, superadmin can delete
    
    # Check if user is admin or superadmin
    user_role = await db.fetchval("SELECT role FROM profiles WHERE id = $1", admin_id)
    
    for parameter in resp_admin.parameters:
        # Get total scenario link count from database
        # (through parameter_items -> scenario_parameter_items)
        total_scenario_links = await db.fetchval("""
            SELECT COUNT(DISTINCT spi.scenario_id)
            FROM parameter_items pi
            JOIN scenario_parameter_items spi ON spi.parameter_item_id = pi.id
            WHERE pi.parameter_id = $1
        """, parameter.parameter_id)
        
        # Rule 1: Parameters with any scenario links - nobody can delete
        if total_scenario_links > 0:
            assert parameter.can_delete == False, \
                f"Parameter {parameter.name} with {total_scenario_links} scenario links should not be deletable"
        
        # Rule 2: Default parameters (unlinked) - only superadmin can delete
        elif parameter.default_parameter:
            if user_role == 'superadmin':
                assert parameter.can_delete == True, \
                    f"Superadmin should be able to delete unlinked default parameter {parameter.name}"
            else:
                assert parameter.can_delete == False, \
                    f"Admin should NOT be able to delete default parameter {parameter.name}"
        
        # Rule 3: Non-default unlinked parameters - admin/superadmin can delete
        else:
            assert parameter.can_delete == True, \
                f"Admin should be able to delete unlinked non-default parameter {parameter.name}"
