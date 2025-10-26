"""Real database integration tests for DepartmentService."""

import asyncpg  # type: ignore
import pytest
from app.schemas.departments import DepartmentDetailRequest  # type: ignore
from app.schemas.departments import DepartmentsFilters  # type: ignore
from app.services.department_service import DepartmentService  # type: ignore
from tests.seed_helpers import get_cs_dept_id  # type: ignore
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


# ============================================================================
# LIST DEPARTMENTS TESTS
# ============================================================================


async def test_get_departments_list_returns_data(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test departments list returns CS department."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = DepartmentService(db)
    resp = await svc.get_departments_list(
        DepartmentsFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    assert len(resp.departments) >= 1
    # Should include CS department
    cs_dept = next((d for d in resp.departments if d.title == "Computer Science"), None)
    assert cs_dept is not None


async def test_get_departments_list_superadmin_can_edit(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that superadmin has edit permissions."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = DepartmentService(db)
    resp = await svc.get_departments_list(
        DepartmentsFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    # Superadmin should have edit permissions
    for dept in resp.departments:
        assert dept.can_edit is True


# ============================================================================
# GET DEPARTMENT DETAIL TESTS
# ============================================================================


async def test_get_department_detail_success(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting department detail with agent roles and mapping."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = DepartmentService(db)
    resp = await svc.get_department_detail(
        DepartmentDetailRequest(departmentId=dept_id, profileId=admin_id)
    )

    assert resp.title is not None
    assert resp.agent_roles is not None
    assert resp.valid_agent_ids is not None
    assert resp.agent_mapping is not None
    # Check structure exists (may be empty if no agents in seed data)
    assert isinstance(resp.valid_agent_ids, list)
    assert isinstance(resp.agent_mapping, dict)

    # CRITICAL: Verify agent_mapping is populated when valid_agent_ids exist
    if len(resp.valid_agent_ids) > 0:
        assert len(resp.agent_mapping) > 0, (
            "agent_mapping should be populated when department has valid agents"
        )
        first_agent_id = resp.valid_agent_ids[0]
        assert first_agent_id in resp.agent_mapping, (
            f"Agent {first_agent_id} should be in agent_mapping"
        )
        agent_item = resp.agent_mapping[first_agent_id]
        assert hasattr(agent_item, "name") and len(agent_item.name) > 0, (
            "Agent mapping should have valid name"
        )
        assert hasattr(agent_item, "description"), (
            "Agent mapping should have description field"
        )
        assert hasattr(agent_item, "roles"), (
            "Agent mapping should have roles field"
        )
        assert isinstance(agent_item.roles, list), (
            "Agent roles should be a list"
        )

    # Verify valid_agent_ids_by_role exists and is structured correctly
    assert hasattr(resp, "valid_agent_ids_by_role"), (
        "Response should have valid_agent_ids_by_role field"
    )
    assert isinstance(resp.valid_agent_ids_by_role, dict), (
        "valid_agent_ids_by_role should be a dict"
    )
    expected_roles = ["title", "scenario", "classify", "assistant", "grade", "input_guardrail", "output_guardrail", "hint"]
    for role in expected_roles:
        assert role in resp.valid_agent_ids_by_role, (
            f"Role {role} should be in valid_agent_ids_by_role"
        )
        assert isinstance(resp.valid_agent_ids_by_role[role], list), (
            f"valid_agent_ids_by_role[{role}] should be a list"
        )


async def test_get_department_detail_has_agent_mappings(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that agent mapping contains name, description, and roles."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = DepartmentService(db)
    resp = await svc.get_department_detail(
        DepartmentDetailRequest(departmentId=dept_id, profileId=admin_id)
    )

    # Verify agent mapping structure
    if resp.agent_mapping:
        for agent_id, agent_info in resp.agent_mapping.items():
            assert agent_info.name is not None
            assert agent_info.description is not None
            assert agent_info.roles is not None
            assert isinstance(agent_info.roles, list)


async def test_get_department_detail_invalid_id(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting department detail with invalid ID."""
    admin_id = await get_superadmin_alias(db)
    fake_dept_id = "00000000-0000-0000-0000-000000000000"

    svc = DepartmentService(db)
    with pytest.raises(ValueError, match="Department.*not found"):
        await svc.get_department_detail(
            DepartmentDetailRequest(departmentId=fake_dept_id, profileId=admin_id)
        )


# ============================================================================
# GET DEPARTMENT DETAIL DEFAULT TESTS
# ============================================================================


async def test_get_department_detail_default_success(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default department detail for creation mode."""
    admin_id = await get_superadmin_alias(db)

    svc = DepartmentService(db)
    resp = await svc.get_department_detail_default(admin_id)

    assert resp.title == ""
    assert resp.description == ""
    assert resp.active is True
    assert resp.valid_agent_ids is not None
    assert resp.agent_mapping is not None

    # CRITICAL: Verify agent_mapping is populated when valid_agent_ids exist
    if len(resp.valid_agent_ids) > 0:
        assert len(resp.agent_mapping) > 0, (
            "agent_mapping should be populated when department has valid agents"
        )
        first_agent_id = resp.valid_agent_ids[0]
        assert first_agent_id in resp.agent_mapping, (
            f"Agent {first_agent_id} should be in agent_mapping"
        )
        agent_item = resp.agent_mapping[first_agent_id]
        assert hasattr(agent_item, "name") and len(agent_item.name) > 0, (
            "Agent mapping should have valid name"
        )
        assert hasattr(agent_item, "description"), (
            "Agent mapping should have description field"
        )
        assert hasattr(agent_item, "roles"), (
            "Agent mapping should have roles field"
        )
        assert isinstance(agent_item.roles, list), (
            "Agent roles should be a list"
        )

    # Verify valid_agent_ids_by_role exists
    assert hasattr(resp, "valid_agent_ids_by_role"), (
        "Response should have valid_agent_ids_by_role field"
    )
    assert isinstance(resp.valid_agent_ids_by_role, dict), (
        "valid_agent_ids_by_role should be a dict"
    )


async def test_get_department_detail_default_consolidated_query(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test C3 consolidation: department default uses single consolidated query."""
    admin_id = await get_superadmin_alias(db)

    svc = DepartmentService(db)
    resp = await svc.get_department_detail_default(admin_id)

    # Verify permissions based on profile role
    assert resp.can_edit is True, "Superadmin should have edit permissions"
    assert resp.can_duplicate is False, "Can't duplicate when creating"
    assert resp.can_delete is False, "Can't delete when creating"

    # Verify agent data is populated in single query
    assert resp.valid_agent_ids is not None
    assert resp.agent_mapping is not None
    assert isinstance(resp.valid_agent_ids, list)
    assert isinstance(resp.agent_mapping, dict)

    # If agents exist, verify mapping contains all valid agents
    if len(resp.valid_agent_ids) > 0:
        assert len(resp.agent_mapping) == len(resp.valid_agent_ids), (
            "agent_mapping should contain all valid_agent_ids"
        )
        for agent_id in resp.valid_agent_ids:
            assert agent_id in resp.agent_mapping, (
                f"Agent {agent_id} from valid_agent_ids should be in agent_mapping"
            )


# ============================================================================
# DEPARTMENT PERMISSIONS TESTS
# ============================================================================


async def test_department_can_edit_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test department can_edit permission logic.

    Rules:
    - False if default_department=true and user is not superadmin
    - True if user is admin or superadmin
    - False otherwise
    """
    dept_id = await get_cs_dept_id(db)

    # Get superadmin and admin profile IDs
    superadmin_id = await get_superadmin_alias(db)
    admin_id = await db.fetchval(
        "SELECT id FROM profiles WHERE role = 'admin' AND default_profile = false LIMIT 1"
    )

    svc = DepartmentService(db)

    # Test with superadmin
    resp_superadmin = await svc.get_departments_list(
        DepartmentsFilters(departmentIds=[dept_id], profileId=str(superadmin_id))
    )

    for dept in resp_superadmin.departments:
        # Superadmin can edit all departments (including default)
        assert dept.can_edit is True, (
            "Superadmin should be able to edit all departments"
        )

    # Test with admin (if one exists)
    if admin_id:
        resp_admin = await svc.get_departments_list(
            DepartmentsFilters(departmentIds=[dept_id], profileId=str(admin_id))
        )

        for dept in resp_admin.departments:
            if dept.default_department:
                # Admin cannot edit default departments
                assert dept.can_edit is False, (
                    "Admin should NOT be able to edit default departments"
                )
            else:
                assert dept.can_edit is True, (
                    "Admin should be able to edit non-default departments"
                )


async def test_department_can_delete_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test department can_delete permission logic.

    Rules:
    - False if default_department=true (even for superadmin)
    - False if any cohort links exist (active or inactive)
    - False if would orphan profiles (profiles with only this department)
    - True if user is admin or superadmin (and no blockers above)
    """
    dept_id = await get_cs_dept_id(db)

    # Get superadmin and admin profile IDs
    superadmin_id = await get_superadmin_alias(db)
    admin_id = await db.fetchval(
        "SELECT id FROM profiles WHERE role = 'admin' AND default_profile = false LIMIT 1"
    )

    svc = DepartmentService(db)

    # Test with superadmin
    resp_superadmin = await svc.get_departments_list(
        DepartmentsFilters(departmentIds=[dept_id], profileId=str(superadmin_id))
    )

    for dept in resp_superadmin.departments:
        # Check if department has any cohort links
        total_cohort_links = await db.fetchval(
            "SELECT COUNT(*) FROM cohorts WHERE department_id = $1", dept.department_id
        )

        # Check if deleting would orphan profiles
        profiles_would_orphan = await db.fetchval(
            """
            SELECT COUNT(*)
            FROM profile_departments pd
            WHERE pd.department_id = $1
            AND NOT EXISTS (
                SELECT 1 FROM profile_departments pd2 
                WHERE pd2.profile_id = pd.profile_id 
                AND pd2.department_id != pd.department_id
            )
            """,
            dept.department_id,
        )

        # Default departments can NEVER be deleted (even by superadmin)
        if dept.default_department:
            assert dept.can_delete is False, (
                "Default departments should NEVER be deletable (even for superadmin)"
            )
        elif total_cohort_links > 0:
            assert dept.can_delete is False, (
                "Department with cohort links should not be deletable"
            )
        elif profiles_would_orphan > 0:
            assert dept.can_delete is False, (
                "Department should not be deletable if it would orphan profiles"
            )
        else:
            assert dept.can_delete is True, (
                "Superadmin should be able to delete non-default departments with no blockers"
            )

    # Test with admin (if one exists)
    if admin_id:
        resp_admin = await svc.get_departments_list(
            DepartmentsFilters(departmentIds=[dept_id], profileId=str(admin_id))
        )

        for dept in resp_admin.departments:
            total_cohort_links = await db.fetchval(
                "SELECT COUNT(*) FROM cohorts WHERE department_id = $1",
                dept.department_id,
            )

            profiles_would_orphan = await db.fetchval(
                """
                SELECT COUNT(*)
                FROM profile_departments pd
                WHERE pd.department_id = $1
                AND NOT EXISTS (
                    SELECT 1 FROM profile_departments pd2 
                    WHERE pd2.profile_id = pd.profile_id 
                    AND pd2.department_id != pd.department_id
                )
                """,
                dept.department_id,
            )

            # Same rules apply for admin
            if dept.default_department:
                assert dept.can_delete is False, (
                    "Admin cannot delete default departments"
                )
            elif total_cohort_links > 0:
                assert dept.can_delete is False, (
                    "Department with cohort links should not be deletable"
                )
            elif profiles_would_orphan > 0:
                assert dept.can_delete is False, (
                    "Department should not be deletable if it would orphan profiles"
                )
            else:
                assert dept.can_delete is True, (
                    "Admin should be able to delete non-default departments with no blockers"
                )


async def test_department_can_duplicate_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test department can_duplicate permission logic.

    Rules:
    - True if user is admin or superadmin
    - False otherwise
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

    svc = DepartmentService(db)

    # Test with superadmin - should be able to duplicate
    resp_superadmin = await svc.get_departments_list(
        DepartmentsFilters(departmentIds=[dept_id], profileId=str(superadmin_id))
    )
    for dept in resp_superadmin.departments:
        assert dept.can_duplicate is True, (
            "Superadmin should be able to duplicate departments"
        )

    # Test with admin - should be able to duplicate
    if admin_id:
        resp_admin = await svc.get_departments_list(
            DepartmentsFilters(departmentIds=[dept_id], profileId=str(admin_id))
        )
        for dept in resp_admin.departments:
            assert dept.can_duplicate is True, (
                "Admin should be able to duplicate departments"
            )

    # Test with instructional - should NOT be able to duplicate
    if instructional_id:
        resp_instructional = await svc.get_departments_list(
            DepartmentsFilters(departmentIds=[dept_id], profileId=str(instructional_id))
        )
        for dept in resp_instructional.departments:
            assert dept.can_duplicate is False, (
                "Instructional should NOT be able to duplicate departments"
            )
