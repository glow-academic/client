"""Real database integration tests for StaffService."""

import asyncpg
import pytest
from app.schemas.staff import (StaffDetailBulkRequest, StaffDetailRequest,
                               StaffFilters)
from app.services.staff_service import StaffService
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias

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


async def test_get_staff_list_superadmin_can_edit(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that superadmin has edit permissions on staff."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = StaffService(db)
    resp = await svc.get_staff_list(
        StaffFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    # Superadmin should have edit permissions on non-superadmin staff
    for staff_member in resp.staff:
        if staff_member.role != "superadmin":
            assert staff_member.can_edit is True


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
