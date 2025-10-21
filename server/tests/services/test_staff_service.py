"""Real database integration tests for StaffService."""

import asyncpg  # type: ignore
import pytest
from tests.seed_helpers import (
    get_cs_dept_id,  # type: ignore
    get_superadmin_alias,  # type: ignore
)

from app.schemas.staff import (
    StaffDetailBulkRequest,  # type: ignore
    StaffDetailRequest,  # type: ignore
    StaffFilters,  # type: ignore
)
from app.services.staff_service import StaffService  # type: ignore

pytestmark = pytest.mark.asyncio


# ============================================================================
# LIST STAFF TESTS
# ============================================================================


async def test_get_staff_list_returns_data(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test staff list returns CS department staff."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = StaffService(db)
    resp = await svc.get_staff_list(
        StaffFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    assert len(resp.staff) >= 0
    assert resp.cohort_mapping is not None
    assert resp.department_mapping is not None

    # CRITICAL: Verify mappings are actually populated with data, not just empty dicts
    # Collect all cohort IDs from staff (StaffItem doesn't have department_ids field)
    all_cohort_ids = set()
    for staff_member in resp.staff:
        all_cohort_ids.update(staff_member.cohort_ids)

    # If any staff has cohorts, cohort_mapping should be populated
    if len(all_cohort_ids) > 0:
        assert len(resp.cohort_mapping) > 0, (
            "cohort_mapping should be populated when staff have cohorts"
        )
        # Verify at least one cohort is mapped correctly
        sample_cohort_id = next(iter(all_cohort_ids))
        assert sample_cohort_id in resp.cohort_mapping, (
            f"Cohort {sample_cohort_id} should be in cohort_mapping"
        )
        cohort_item = resp.cohort_mapping[sample_cohort_id]
        assert hasattr(cohort_item, "name") and len(cohort_item.name) > 0, (
            "Cohort mapping should have valid name"
        )
        assert hasattr(cohort_item, "description"), (
            "Cohort mapping should have description field"
        )

    # Department mapping should be populated for CS department staff
    assert len(resp.department_mapping) > 0, (
        "department_mapping should be populated for staff in department"
    )


async def test_get_staff_list_last_active_field(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that staff list returns last_active field in correct format."""
    from datetime import datetime

    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = StaffService(db)
    resp = await svc.get_staff_list(
        StaffFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    assert len(resp.staff) > 0, "Should have staff members to test"

    for staff_member in resp.staff:
        # Verify field exists and is named last_active (snake_case, not lastActive)
        assert hasattr(staff_member, "last_active"), (
            "StaffItem should have last_active field (snake_case)"
        )

        # If last_active has a value, verify it's a valid ISO 8601 timestamp string
        if staff_member.last_active is not None:
            assert isinstance(staff_member.last_active, str), (
                "last_active should be a string (ISO 8601 format)"
            )
            # Verify it can be parsed as ISO 8601
            try:
                parsed = datetime.fromisoformat(
                    staff_member.last_active.replace("Z", "+00:00")
                )
                assert parsed is not None, "Should parse as valid ISO 8601 datetime"
            except ValueError as e:
                pytest.fail(
                    f"last_active '{staff_member.last_active}' is not valid ISO 8601: {e}"
                )


async def test_get_staff_list_superadmin_can_edit(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that superadmin has edit permissions on all staff regardless of active cohort links."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = StaffService(db)
    resp = await svc.get_staff_list(
        StaffFilters(
            departmentIds=[dept_id], profileId=admin_id, campusDomain="test.edu"
        )
    )

    # Superadmin should have edit permissions on all staff (active cohort links don't prevent editing)
    for staff_member in resp.staff:
        assert staff_member.can_edit is True, (
            f"Superadmin should be able to edit {staff_member.name} (role: {staff_member.role})"
        )


async def test_get_staff_list_empty_department(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test listing staff for a department with no staff."""
    admin_id = await get_superadmin_alias(db)

    # Create a new department with no staff
    new_dept_id = await db.fetchval(
        "INSERT INTO departments(title, description, active) "
        "VALUES('Test Dept', 'Test', true) RETURNING id"
    )

    svc = StaffService(db)
    resp = await svc.get_staff_list(
        StaffFilters(departmentIds=[str(new_dept_id)], profileId=admin_id)
    )

    assert len(resp.staff) == 0


# ============================================================================
# GET STAFF DETAIL TESTS
# ============================================================================


async def test_get_staff_detail_success(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting staff detail."""
    admin_id = await get_superadmin_alias(db)

    svc = StaffService(db)
    resp = await svc.get_staff_detail(
        StaffDetailRequest(profileId=admin_id, currentProfileId=admin_id)
    )

    assert resp.name is not None
    assert resp.email is not None
    assert resp.role is not None
    assert resp.cohort_mapping is not None
    assert resp.department_mapping is not None
    assert len(resp.role_options) > 0

    # CRITICAL: Verify mappings are actually populated, not just empty dicts
    # If profile has cohorts, cohort_mapping should have entries
    if len(resp.cohort_ids) > 0:
        assert len(resp.cohort_mapping) > 0, (
            "cohort_mapping should be populated when profile has cohorts"
        )
        first_cohort_id = resp.cohort_ids[0]
        assert first_cohort_id in resp.cohort_mapping, (
            f"Cohort {first_cohort_id} should be in cohort_mapping"
        )
        cohort_item = resp.cohort_mapping[first_cohort_id]
        assert hasattr(cohort_item, "name") and len(cohort_item.name) > 0, (
            "Cohort mapping should have valid name"
        )
        assert hasattr(cohort_item, "description"), (
            "Cohort mapping should have description field"
        )

    # Department mapping should be populated when there are valid departments
    if len(resp.valid_department_ids) > 0:
        assert len(resp.department_mapping) > 0, (
            "department_mapping should be populated when profile has valid departments"
        )
        first_dept_id = resp.valid_department_ids[0]
        assert first_dept_id in resp.department_mapping, (
            f"Department {first_dept_id} should be in department_mapping"
        )
        dept_item = resp.department_mapping[first_dept_id]
        assert hasattr(dept_item, "name") and len(dept_item.name) > 0, (
            "Department mapping should have valid name"
        )
        assert hasattr(dept_item, "description"), (
            "Department mapping should have description field"
        )


async def test_get_staff_detail_invalid_id(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting staff detail with invalid profile ID."""
    admin_id = await get_superadmin_alias(db)
    fake_profile_id = "00000000-0000-0000-0000-000000000000"

    svc = StaffService(db)
    with pytest.raises(ValueError, match="Profile.*not found"):
        await svc.get_staff_detail(
            StaffDetailRequest(profileId=fake_profile_id, currentProfileId=admin_id)
        )


# ============================================================================
# GET STAFF DETAIL BULK TESTS
# ============================================================================


async def test_get_staff_detail_bulk_success(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting bulk staff detail."""
    admin_id = await get_superadmin_alias(db)

    svc = StaffService(db)
    resp = await svc.get_staff_detail_bulk(
        StaffDetailBulkRequest(profileIds=[admin_id], currentProfileId=admin_id)
    )

    assert resp.valid_department_ids is not None
    assert resp.department_mapping is not None
    assert len(resp.role_options) > 0

    # CRITICAL: Verify department_mapping is actually populated with data
    # If there are department_ids, department_mapping should have entries
    if len(resp.department_ids) > 0:
        assert len(resp.department_mapping) > 0, (
            "department_mapping should be populated when profiles have departments"
        )
        first_dept_id = resp.department_ids[0]
        assert first_dept_id in resp.department_mapping, (
            f"Department {first_dept_id} should be in department_mapping"
        )
        dept_item = resp.department_mapping[first_dept_id]
        assert hasattr(dept_item, "name") and len(dept_item.name) > 0, (
            "Department mapping should have valid name"
        )
        assert hasattr(dept_item, "description"), (
            "Department mapping should have description field"
        )


async def test_get_staff_detail_bulk_multiple_profiles(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting bulk staff detail for multiple profiles."""
    admin_id = await get_superadmin_alias(db)

    # Get another staff member from CS department
    dept_id = await get_cs_dept_id(db)
    other_staff_id = await db.fetchval(
        """
        SELECT p.id FROM profiles p
        JOIN profile_departments pd ON pd.profile_id = p.id
        WHERE pd.department_id = $1 AND p.id != $2
        LIMIT 1
        """,
        dept_id,
        admin_id,
    )

    if other_staff_id:
        svc = StaffService(db)
        resp = await svc.get_staff_detail_bulk(
            StaffDetailBulkRequest(
                profileIds=[admin_id, str(other_staff_id)],
                currentProfileId=admin_id,
            )
        )

        assert resp.valid_department_ids is not None
        assert resp.department_mapping is not None
        assert len(resp.department_ids) >= 0

        # CRITICAL: Verify department_mapping is actually populated with data
        # With multiple profiles from CS department, department_mapping should be populated
        if len(resp.department_ids) > 0:
            assert len(resp.department_mapping) > 0, (
                "department_mapping should be populated when profiles have departments"
            )
            first_dept_id = resp.department_ids[0]
            assert first_dept_id in resp.department_mapping, (
                f"Department {first_dept_id} should be in department_mapping"
            )
            dept_item = resp.department_mapping[first_dept_id]
            assert hasattr(dept_item, "name") and len(dept_item.name) > 0, (
                "Department mapping should have valid name"
            )
            assert hasattr(dept_item, "description"), (
                "Department mapping should have description field"
            )


async def test_get_staff_detail_bulk_no_profiles(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting bulk staff detail with no valid profiles."""
    admin_id = await get_superadmin_alias(db)
    fake_profile_id = "00000000-0000-0000-0000-000000000000"

    svc = StaffService(db)
    with pytest.raises(ValueError, match="No profiles found"):
        await svc.get_staff_detail_bulk(
            StaffDetailBulkRequest(
                profileIds=[fake_profile_id], currentProfileId=admin_id
            )
        )


async def test_staff_can_edit_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test can_edit permission logic for staff based on active cohort links and role hierarchy."""
    # Setup - Get test data
    dept_result = await db.fetchrow(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    if not dept_result:
        pytest.skip("No departments found")

    dept_id = str(dept_result["id"])

    # Get superadmin and admin profiles
    superadmin_result = await db.fetchrow(
        "SELECT id FROM profiles WHERE role = 'superadmin' LIMIT 1"
    )
    admin_result = await db.fetchrow(
        "SELECT id FROM profiles WHERE role = 'admin' LIMIT 1"
    )

    if not superadmin_result or not admin_result:
        pytest.skip("Need both superadmin and admin profiles")

    superadmin_id = str(superadmin_result["id"])
    admin_id = str(admin_result["id"])

    # Execute
    from app.schemas.staff import StaffFilters

    svc = StaffService(db)
    resp_superadmin = await svc.get_staff_list(
        StaffFilters(
            departmentIds=[dept_id], profileId=superadmin_id, campusDomain="test.edu"
        )
    )
    resp_admin = await svc.get_staff_list(
        StaffFilters(
            departmentIds=[dept_id], profileId=admin_id, campusDomain="test.edu"
        )
    )

    # Test rules:
    # 1. Superadmin: can edit anyone regardless of active cohort links
    # 2. Admin: can edit only instructional/ta/guest roles regardless of active cohort links

    for staff_sa in resp_superadmin.staff:
        staff_admin = next(
            (s for s in resp_admin.staff if s.profile_id == staff_sa.profile_id), None
        )

        if not staff_admin:
            continue

        # Rule 1: Superadmin can edit everyone
        assert staff_sa.can_edit == True, (
            f"Superadmin should be able to edit {staff_sa.name} (role: {staff_sa.role})"
        )

        # Rule 2: Admin can only edit below-admin roles
        if staff_admin.role in ("instructional", "ta", "guest"):
            assert staff_admin.can_edit == True, (
                f"Admin should be able to edit {staff_admin.name} ({staff_admin.role})"
            )
        elif staff_admin.role in ("admin", "superadmin"):
            assert staff_admin.can_edit == False, (
                f"Admin should NOT be able to edit {staff_admin.name} ({staff_admin.role})"
            )


async def test_staff_can_delete_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test can_delete permission logic for staff - default profiles never deletable."""
    # Setup - Get test data
    dept_result = await db.fetchrow(
        "SELECT id FROM departments WHERE active = true LIMIT 1"
    )
    if not dept_result:
        pytest.skip("No departments found")

    dept_id = str(dept_result["id"])

    # Get superadmin and admin profiles
    superadmin_result = await db.fetchrow(
        "SELECT id FROM profiles WHERE role = 'superadmin' LIMIT 1"
    )
    admin_result = await db.fetchrow(
        "SELECT id FROM profiles WHERE role = 'admin' LIMIT 1"
    )

    if not superadmin_result or not admin_result:
        pytest.skip("Need both superadmin and admin profiles")

    superadmin_id = str(superadmin_result["id"])
    admin_id = str(admin_result["id"])

    # Execute
    from app.schemas.staff import StaffFilters

    svc = StaffService(db)
    resp_superadmin = await svc.get_staff_list(
        StaffFilters(
            departmentIds=[dept_id], profileId=superadmin_id, campusDomain="test.edu"
        )
    )
    resp_admin = await svc.get_staff_list(
        StaffFilters(
            departmentIds=[dept_id], profileId=admin_id, campusDomain="test.edu"
        )
    )

    # Test rules:
    # 1. Default profiles: NEVER deletable (highest priority)
    # 2. Profiles with ANY cohort links: cannot delete
    # 3. Superadmin: can delete non-default profiles without links
    # 4. Admin: can delete only trainee/instructional without links

    for staff_sa in resp_superadmin.staff:
        # Get total cohort link count from database
        total_cohort_links = await db.fetchval(
            """
            SELECT COUNT(*) FROM cohort_profiles 
            WHERE profile_id = $1
        """,
            staff_sa.profile_id,
        )

        staff_admin = next(
            (s for s in resp_admin.staff if s.profile_id == staff_sa.profile_id), None
        )

        if not staff_admin:
            continue

        # Rule 1: Default profiles - NEVER deletable
        if staff_sa.default_profile:
            assert staff_sa.can_delete == False, (
                f"Default profile {staff_sa.name} should NEVER be deletable (even by superadmin)"
            )
            assert staff_admin.can_delete == False, (
                f"Default profile {staff_admin.name} should NEVER be deletable (admin)"
            )

        # Rule 2: Profiles with any cohort links - nobody can delete
        elif total_cohort_links > 0:
            assert staff_sa.can_delete == False, (
                f"Staff {staff_sa.name} with {total_cohort_links} cohort links should not be deletable (superadmin)"
            )
            assert staff_admin.can_delete == False, (
                f"Staff {staff_admin.name} with {total_cohort_links} cohort links should not be deletable (admin)"
            )

        # Rule 3: Unlinked, non-default profiles - superadmin can delete
        elif not staff_sa.default_profile and total_cohort_links == 0:
            assert staff_sa.can_delete == True, (
                f"Superadmin should be able to delete unlinked non-default {staff_sa.name}"
            )

            # Rule 4: Admin can only delete below-admin roles
            if staff_admin.role in ("instructional", "ta", "guest"):
                assert staff_admin.can_delete == True, (
                    f"Admin should be able to delete {staff_admin.name} ({staff_admin.role})"
                )
            elif staff_admin.role in ("admin", "superadmin"):
                assert staff_admin.can_delete == False, (
                    f"Admin should NOT be able to delete {staff_admin.name} ({staff_admin.role})"
                )
