"""
Tests for rubric_service - list methods.
"""

import asyncpg  # type: ignore
import pytest

from app.schemas.rubrics import (
    RubricDetailRequest,  # type: ignore
    RubricsFilters,  # type: ignore
)
from app.services.rubric_service import RubricService  # type: ignore

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
async def test_get_rubrics_list(db: asyncpg.Connection, disable_cache: None) -> None:
    """Test getting rubrics list with embedded hierarchical structure."""
    # Setup - Get test data IDs
    dept_id = await get_test_dept_id(db)
    profile_id = await get_test_profile_id(db)

    # Create filters
    filters = RubricsFilters(departmentIds=[dept_id], profileId=profile_id)

    # Execute - Call the service method
    svc = RubricService(db)
    result = await svc.get_rubrics_list(filters)

    # Assert - Check basic structure
    assert result is not None
    assert hasattr(result, "rubrics")
    assert hasattr(result, "standard_groups_mapping")
    assert hasattr(result, "standards_mapping")

    # Check that rubrics is a list (could be empty)
    assert isinstance(result.rubrics, list)
    assert len(result.rubrics) >= 0

    # Check that mappings are dicts (could be empty)
    assert isinstance(result.standard_groups_mapping, dict)
    assert isinstance(result.standards_mapping, dict)

    # If rubrics exist, check hierarchical structure
    if result.rubrics:
        rubric = result.rubrics[0]
        assert hasattr(rubric, "rubric_id")
        assert hasattr(rubric, "name")
        assert hasattr(rubric, "standard_groups")
        assert isinstance(rubric.standard_groups, dict)


@pytest.mark.asyncio
async def test_get_rubrics_list_empty_departments(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting rubrics list with no departments returns empty list."""
    # Setup
    profile_id = await get_test_profile_id(db)

    # Create filters with empty department list
    filters = RubricsFilters(departmentIds=[], profileId=profile_id)

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

    rubric_id = str(rubric_result["id"])
    profile_id = await get_test_profile_id(db)

    # Create request
    request = RubricDetailRequest(rubricId=rubric_id, profileId=profile_id)

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

    # CRITICAL: Verify department_mapping is populated when department_id exists
    if result.department_id:
        assert len(result.department_mapping) > 0, (
            "department_mapping should be populated when rubric has department"
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

    # CRITICAL: Verify standard_groups_mapping is populated when standard_group_ids exist
    if len(result.standard_group_ids) > 0:
        assert len(result.standard_groups_mapping) > 0, (
            "standard_groups_mapping should be populated when rubric has standard groups"
        )
        first_group_id = result.standard_group_ids[0]
        assert first_group_id in result.standard_groups_mapping, (
            f"Standard group {first_group_id} should be in standard_groups_mapping"
        )
        group_item = result.standard_groups_mapping[first_group_id]
        assert hasattr(group_item, "name") and len(group_item.name) > 0, (
            "Standard group mapping should have valid name"
        )
        assert hasattr(group_item, "description"), (
            "Standard group mapping should have description field"
        )

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
        rubricId="00000000-0000-0000-0000-000000000000", profileId=profile_id
    )

    # Execute & Assert - Should raise ValueError
    svc = RubricService(db)
    with pytest.raises(ValueError, match="Rubric not found"):
        await svc.get_rubric_detail(request)


@pytest.mark.asyncio
async def test_rubric_can_edit_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test can_edit permission logic for rubrics based on active simulation links."""
    # Setup - Get test data
    dept_result = await db.fetchrow(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    if not dept_result:
        pytest.skip("No departments found")

    dept_id = str(dept_result["id"])

    # Get admin profile (only admin/superadmin have access to rubrics, not instructional)
    admin_result = await db.fetchrow(
        "SELECT id FROM profiles WHERE role IN ('admin', 'superadmin') LIMIT 1"
    )

    if not admin_result:
        pytest.skip("Need admin/superadmin profile")

    admin_id = str(admin_result["id"])

    # Execute
    from app.schemas.rubrics import RubricsFilters

    svc = RubricService(db)
    resp_admin = await svc.get_rubrics_list(
        RubricsFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    # Test rules:
    # 1. Rubrics with active simulation links: cannot edit
    # 2. Default rubrics: only superadmin can edit (admin cannot)
    # 3. Other rubrics: admin, superadmin can edit

    # Check if user is admin or superadmin
    user_role = await db.fetchval("SELECT role FROM profiles WHERE id = $1", admin_id)

    for rubric in resp_admin.rubrics:
        # Get active simulation link counts from database
        active_simulation_count = await db.fetchval(
            """
            SELECT COUNT(*) FROM simulations 
            WHERE rubric_id = $1 AND active = true
        """,
            rubric.rubric_id,
        )

        # Rule 1: Rubrics with active simulation links - nobody can edit
        if active_simulation_count > 0:
            assert rubric.can_edit == False, (
                f"Rubric {rubric.name} with {active_simulation_count} active simulation links should not be editable"
            )

        # Rule 2: Default rubrics - only superadmin can edit
        elif rubric.default_rubric:
            if user_role == "superadmin":
                assert rubric.can_edit == True, (
                    f"Superadmin should be able to edit default rubric {rubric.name}"
                )
            else:
                assert rubric.can_edit == False, (
                    f"Admin should NOT be able to edit default rubric {rubric.name}"
                )

        # Rule 3: Non-default rubrics without active simulation links - admin/superadmin can edit
        else:
            assert rubric.can_edit == True, (
                f"Admin should be able to edit non-default rubric {rubric.name} without active simulation links"
            )


@pytest.mark.asyncio
async def test_rubric_can_delete_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test can_delete permission logic for rubrics based on all simulation links."""
    # Setup - Get test data
    dept_result = await db.fetchrow(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    if not dept_result:
        pytest.skip("No departments found")

    dept_id = str(dept_result["id"])

    # Get admin profile
    admin_result = await db.fetchrow(
        "SELECT id FROM profiles WHERE role IN ('admin', 'superadmin') LIMIT 1"
    )

    if not admin_result:
        pytest.skip("Need admin/superadmin profile")

    admin_id = str(admin_result["id"])

    # Execute
    from app.schemas.rubrics import RubricsFilters

    svc = RubricService(db)
    resp_admin = await svc.get_rubrics_list(
        RubricsFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    # Test rules:
    # 1. Rubrics with ANY simulation links (active or inactive): cannot delete
    # 2. Default rubrics (not linked): only superadmin can delete
    # 3. Other rubrics: admin, superadmin can delete

    # Check if user is admin or superadmin
    user_role = await db.fetchval("SELECT role FROM profiles WHERE id = $1", admin_id)

    for rubric in resp_admin.rubrics:
        # Get total simulation link count from database
        total_simulation_links = await db.fetchval(
            """
            SELECT COUNT(*) FROM simulations 
            WHERE rubric_id = $1
        """,
            rubric.rubric_id,
        )

        # Rule 1: Rubrics with any simulation links - nobody can delete
        if total_simulation_links > 0:
            assert rubric.can_delete == False, (
                f"Rubric {rubric.name} with {total_simulation_links} simulation links should not be deletable"
            )

        # Rule 2: Default rubrics (unlinked) - only superadmin can delete
        elif rubric.default_rubric:
            if user_role == "superadmin":
                assert rubric.can_delete == True, (
                    f"Superadmin should be able to delete unlinked default rubric {rubric.name}"
                )
            else:
                assert rubric.can_delete == False, (
                    f"Admin should NOT be able to delete default rubric {rubric.name}"
                )

        # Rule 3: Non-default unlinked rubrics - admin/superadmin can delete
        else:
            assert rubric.can_delete == True, (
                f"Admin should be able to delete unlinked non-default rubric {rubric.name}"
            )


async def test_rubric_can_duplicate_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test rubric can_duplicate permission logic.

    Rules:
    - True if user is admin or superadmin
    - False otherwise (e.g., instructional, trainee)
    """
    dept_id = await get_cs_dept_id(db)

    # Get superadmin, admin, and instructional profile IDs
    superadmin_id = await get_superadmin_alias(db)
    admin_id = await db.fetchval(
        "SELECT id FROM profiles WHERE role = 'admin' AND default_profile = false LIMIT 1"
    )
    instructional_id = await db.fetchval(
        "SELECT id FROM profiles WHERE role = 'instructional' LIMIT 1"
    )

    svc = RubricService(db)

    # Test with superadmin - should be able to duplicate
    resp_superadmin = await svc.get_rubrics_list(
        RubricsFilters(departmentIds=[dept_id], profileId=superadmin_id)
    )
    for rubric in resp_superadmin.rubrics:
        assert rubric.can_duplicate is True, (
            "Superadmin should be able to duplicate rubrics"
        )

    # Test with admin - should be able to duplicate
    if admin_id:
        resp_admin = await svc.get_rubrics_list(
            RubricsFilters(departmentIds=[dept_id], profileId=admin_id)
        )
        for rubric in resp_admin.rubrics:
            assert rubric.can_duplicate is True, (
                "Admin should be able to duplicate rubrics"
            )

    # Test with instructional - should NOT be able to duplicate (instructional doesn't have access to rubrics page)
    if instructional_id:
        resp_instructional = await svc.get_rubrics_list(
            RubricsFilters(departmentIds=[dept_id], profileId=instructional_id)
        )
        for rubric in resp_instructional.rubrics:
            assert rubric.can_duplicate is False, (
                "Instructional should NOT be able to duplicate rubrics"
            )


@pytest.mark.asyncio
async def test_get_rubric_detail_default_consolidated(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default rubric detail with consolidated query (1 query instead of 2)."""
    # Setup - Get test profile ID
    profile_id = await get_test_profile_id(db)

    # Create request
    from app.schemas.rubrics import RubricDetailDefaultRequest

    request = RubricDetailDefaultRequest(profileId=profile_id)

    # Execute - Call the service method
    svc = RubricService(db)
    result = await svc.get_rubric_detail_default(request)

    # Assert - Check basic structure
    assert result is not None
    assert hasattr(result, "name")
    assert hasattr(result, "description")
    assert hasattr(result, "department_id")
    assert hasattr(result, "active")
    assert hasattr(result, "default_rubric")
    assert hasattr(result, "points")
    assert hasattr(result, "passPoints")
    assert hasattr(result, "standard_group_ids")
    assert hasattr(result, "standard_groups_detail")
    assert hasattr(result, "department_mapping")
    assert hasattr(result, "valid_department_ids")

    # Check that it returns actual data
    assert result.name is not None
    assert result.department_id is not None
    assert isinstance(result.standard_group_ids, list)
    assert isinstance(result.standard_groups_detail, dict)
    assert isinstance(result.department_mapping, dict)
    assert isinstance(result.valid_department_ids, list)
