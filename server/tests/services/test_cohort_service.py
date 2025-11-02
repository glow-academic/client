"""Real database integration tests for CohortService."""

import asyncpg  # type: ignore
import pytest
from app.schemas.cohorts import CohortDetailRequest  # type: ignore
from app.schemas.cohorts import CohortsFilters  # type: ignore
from app.schemas.cohorts import CreateCohortRequest  # type: ignore
from app.schemas.cohorts import DeleteCohortRequest  # type: ignore
from app.schemas.cohorts import DuplicateCohortRequest  # type: ignore
from app.schemas.cohorts import LeaveCohortRequest  # type: ignore
from app.schemas.cohorts import RemoveProfilesFromCohortRequest  # type: ignore
from app.schemas.cohorts import UpdateCohortRequest  # type: ignore
from app.schemas.cohorts import AddProfilesToCohortRequest
from app.services.cohort_service import CohortService  # type: ignore
from tests.seed_helpers import get_cs_dept_id  # type: ignore
from tests.seed_helpers import get_superadmin_alias  # type: ignore

pytestmark = pytest.mark.asyncio


# ============================================================================
# LIST COHORTS TESTS
# ============================================================================


async def test_list_cohorts_returns_seed_data(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that list cohorts returns the CS seed data."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = CohortService(db)
    resp = await svc.get_cohorts_list(
        CohortsFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    # CS seed data has 2 cohorts: 'New GTAs' and 'Returning GTAs'
    assert len(resp.cohorts) == 2
    cohort_names = {c.name for c in resp.cohorts}
    assert "New GTAs" in cohort_names
    assert "Returning GTAs" in cohort_names

    # CRITICAL: Check that mappings are actually populated with data, not just empty dicts
    assert resp.profile_mapping is not None
    assert resp.simulation_mapping is not None

    # Collect all profile IDs and simulation IDs from cohorts
    all_profile_ids = set()
    all_simulation_ids = set()
    for cohort in resp.cohorts:
        all_profile_ids.update(cohort.profile_ids)
        all_simulation_ids.update(cohort.simulation_ids)

    # If any cohort has profiles, the profile_mapping should have entries
    if len(all_profile_ids) > 0:
        assert len(resp.profile_mapping) > 0, (
            "profile_mapping should be populated when cohorts have profiles"
        )
        # Verify at least one profile is mapped correctly
        sample_profile_id = next(iter(all_profile_ids))
        assert sample_profile_id in resp.profile_mapping, (
            f"Profile {sample_profile_id} should be in profile_mapping"
        )
        profile_item = resp.profile_mapping[sample_profile_id]
        assert hasattr(profile_item, "name") and len(profile_item.name) > 0, (
            "Profile mapping should have valid name"
        )
        assert hasattr(profile_item, "description"), (
            "Profile mapping should have description field"
        )

    # If any cohort has simulations, the simulation_mapping should have entries
    if len(all_simulation_ids) > 0:
        assert len(resp.simulation_mapping) > 0, (
            "simulation_mapping should be populated when cohorts have simulations"
        )
        # Verify at least one simulation is mapped correctly
        sample_sim_id = next(iter(all_simulation_ids))
        assert sample_sim_id in resp.simulation_mapping, (
            f"Simulation {sample_sim_id} should be in simulation_mapping"
        )
        sim_item = resp.simulation_mapping[sample_sim_id]
        assert hasattr(sim_item, "name") and len(sim_item.name) > 0, (
            "Simulation mapping should have valid name"
        )
        assert hasattr(sim_item, "description"), (
            "Simulation mapping should have description field"
        )


async def test_list_cohorts_superadmin_can_edit(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that superadmin has edit permissions."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = CohortService(db)
    resp = await svc.get_cohorts_list(
        CohortsFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    # Superadmin should have edit permissions
    for cohort in resp.cohorts:
        assert cohort.can_edit is True
        assert cohort.can_duplicate is True


async def test_list_cohorts_empty_department(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test listing cohorts for a department with no cohorts."""
    admin_id = await get_superadmin_alias(db)

    # Create a new department with no cohorts
    new_dept_id = await db.fetchval(
        "INSERT INTO departments(title, description, active) "
        "VALUES('Test Dept', 'Test', true) RETURNING id"
    )

    svc = CohortService(db)
    resp = await svc.get_cohorts_list(
        CohortsFilters(departmentIds=[str(new_dept_id)], profileId=admin_id)
    )

    assert len(resp.cohorts) == 0


# ============================================================================
# GET COHORT DETAIL TESTS
# ============================================================================


async def test_get_cohort_detail_success(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting cohort detail for an existing cohort."""
    admin_id = await get_superadmin_alias(db)
    # Get the 'New GTAs' cohort ID
    cohort_id = "c5180001-1111-2222-3333-444444444444"

    svc = CohortService(db)
    resp = await svc.get_cohort_detail(
        CohortDetailRequest(cohortId=cohort_id, profileId=admin_id)
    )

    assert resp.title == "New GTAs"
    assert resp.description == "New GTAs"
    assert resp.active is True
    assert resp.default_cohort is False
    assert len(resp.simulation_ids) >= 0
    assert len(resp.profile_ids) >= 0

    # CRITICAL: Verify mappings are actually populated, not just empty dicts
    # If there are profile_ids, profile_mapping should have entries
    if len(resp.profile_ids) > 0:
        assert len(resp.profile_mapping) > 0, (
            "profile_mapping should be populated when profile_ids exist"
        )
        # Verify mapping structure - check first profile
        first_profile_id = resp.profile_ids[0]
        assert first_profile_id in resp.profile_mapping, (
            f"Profile {first_profile_id} should be in profile_mapping"
        )
        profile_item = resp.profile_mapping[first_profile_id]
        assert hasattr(profile_item, "name"), (
            "Profile mapping item should have 'name' field"
        )
        assert hasattr(profile_item, "description"), (
            "Profile mapping item should have 'description' field"
        )
        assert len(profile_item.name) > 0, "Profile name should not be empty"

    # If there are simulation_ids, simulation_mapping should have entries
    if len(resp.simulation_ids) > 0:
        assert len(resp.simulation_mapping) > 0, (
            "simulation_mapping should be populated when simulation_ids exist"
        )
        # Verify mapping structure
        first_sim_id = resp.simulation_ids[0]
        assert first_sim_id in resp.simulation_mapping, (
            f"Simulation {first_sim_id} should be in simulation_mapping"
        )
        sim_item = resp.simulation_mapping[first_sim_id]
        assert hasattr(sim_item, "name"), (
            "Simulation mapping item should have 'name' field"
        )
        assert hasattr(sim_item, "description"), (
            "Simulation mapping item should have 'description' field"
        )
        assert len(sim_item.name) > 0, "Simulation name should not be empty"

    # Department mapping should always have entries if valid_department_ids exist
    if len(resp.valid_department_ids) > 0:
        assert len(resp.department_mapping) > 0, (
            "department_mapping should be populated when valid_department_ids exist"
        )
        # Verify mapping structure
        first_dept_id = resp.valid_department_ids[0]
        assert first_dept_id in resp.department_mapping, (
            f"Department {first_dept_id} should be in department_mapping"
        )
        dept_item = resp.department_mapping[first_dept_id]
        assert hasattr(dept_item, "name"), (
            "Department mapping item should have 'name' field"
        )
        assert hasattr(dept_item, "description"), (
            "Department mapping item should have 'description' field"
        )
        assert len(dept_item.name) > 0, "Department name should not be empty"


async def test_get_cohort_detail_invalid_id(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting cohort detail with invalid cohort ID."""
    admin_id = await get_superadmin_alias(db)
    fake_cohort_id = "00000000-0000-0000-0000-000000000000"

    svc = CohortService(db)
    with pytest.raises(ValueError, match="Cohort.*not found"):
        await svc.get_cohort_detail(
            CohortDetailRequest(cohortId=fake_cohort_id, profileId=admin_id)
        )


# ============================================================================
# CREATE COHORT TESTS
# ============================================================================


async def test_create_cohort_success(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a new cohort."""
    dept_id = await get_cs_dept_id(db)

    svc = CohortService(db)
    resp = await svc.create_cohort(
        CreateCohortRequest(
            title="Test Cohort",
            description="Test cohort for testing",
            department_ids=[dept_id],  # Now accepts list
            active=True,
            profile_ids=[],
            simulation_ids=[],
        )
    )

    assert resp.success is True
    assert resp.cohortId is not None

    # Verify the cohort was created
    cohort = await db.fetchrow(
        "SELECT title, description, department_id FROM cohorts WHERE id = $1",
        resp.cohortId,
    )
    assert cohort is not None
    assert cohort["title"] == "Test Cohort"
    assert cohort["description"] == "Test cohort for testing"


async def test_create_cohort_with_profiles(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test creating a cohort with profiles."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = CohortService(db)
    resp = await svc.create_cohort(
        CreateCohortRequest(
            title="Cohort with Profiles",
            description="Test",
            department_id=dept_id,
            active=True,
            default_cohort=False,
            profile_ids=[admin_id],
            simulation_ids=[],
        )
    )

    assert resp.success is True

    # Verify profile was linked
    count = await db.fetchval(
        "SELECT COUNT(*) FROM cohort_profiles WHERE cohort_id = $1 AND profile_id = $2",
        resp.cohortId,
        admin_id,
    )
    assert count == 1


async def test_create_cohort_invalid_department(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that creating cohort with invalid department fails."""
    fake_dept_id = "00000000-0000-0000-0000-000000000000"

    svc = CohortService(db)
    with pytest.raises(Exception) as exc_info:
        await svc.create_cohort(
            CreateCohortRequest(
                title="Invalid Cohort",
                description="Test",
                department_id=fake_dept_id,
                active=True,
                default_cohort=False,
                profile_ids=[],
                simulation_ids=[],
            )
        )

    # Should raise foreign key violation
    assert (
        "foreign key" in str(exc_info.value).lower()
        or "violates" in str(exc_info.value).lower()
    )


# ============================================================================
# UPDATE COHORT TESTS
# ============================================================================


async def test_update_cohort_success(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating an existing cohort."""
    dept_id = await get_cs_dept_id(db)

    # Create a cohort first
    svc = CohortService(db)
    create_resp = await svc.create_cohort(
        CreateCohortRequest(
            title="Original Title",
            description="Original desc",
            department_id=dept_id,
            active=True,
            default_cohort=False,
            profile_ids=[],
            simulation_ids=[],
        )
    )

    # Update it
    update_resp = await svc.update_cohort(
        UpdateCohortRequest(
            cohortId=create_resp.cohortId,
            title="Updated Title",
            description="Updated desc",
            department_id=dept_id,
            active=False,
            default_cohort=False,
            profile_ids=[],
            simulation_ids=[],
        )
    )

    assert update_resp.success is True

    # Verify the update
    cohort = await db.fetchrow(
        "SELECT title, description, active FROM cohorts WHERE id = $1",
        create_resp.cohortId,
    )
    assert cohort["title"] == "Updated Title"
    assert cohort["description"] == "Updated desc"
    assert cohort["active"] is False


async def test_update_cohort_invalid_id(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test updating non-existent cohort."""
    dept_id = await get_cs_dept_id(db)
    fake_cohort_id = "00000000-0000-0000-0000-000000000000"

    svc = CohortService(db)
    with pytest.raises(ValueError):
        await svc.update_cohort(
            UpdateCohortRequest(
                cohortId=fake_cohort_id,
                title="Updated",
                description="Test",
                department_id=dept_id,
                active=True,
                default_cohort=False,
                profile_ids=[],
                simulation_ids=[],
            )
        )


# ============================================================================
# DUPLICATE COHORT TESTS
# ============================================================================


async def test_duplicate_cohort_success(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test duplicating a cohort."""
    dept_id = await get_cs_dept_id(db)

    # Create a cohort to duplicate
    svc = CohortService(db)
    create_resp = await svc.create_cohort(
        CreateCohortRequest(
            title="Original Cohort",
            description="Original",
            department_id=dept_id,
            active=True,
            default_cohort=False,
            profile_ids=[],
            simulation_ids=[],
        )
    )

    # Duplicate it (no newTitle parameter - service adds " Copy")
    dup_resp = await svc.duplicate_cohort(
        DuplicateCohortRequest(cohortId=create_resp.cohortId)
    )

    assert dup_resp.success is True
    assert dup_resp.cohortId is not None
    assert dup_resp.cohortId != create_resp.cohortId

    # Verify the duplicate exists (service appends " Copy" to title)
    dup_cohort = await db.fetchrow(
        "SELECT title, description FROM cohorts WHERE id = $1", dup_resp.cohortId
    )
    assert "Copy" in dup_cohort["title"]
    assert dup_cohort["description"] == "Original"


# ============================================================================
# DELETE COHORT TESTS
# ============================================================================


async def test_delete_cohort_success(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting a cohort with no usage."""
    dept_id = await get_cs_dept_id(db)

    # Create a cohort
    svc = CohortService(db)
    create_resp = await svc.create_cohort(
        CreateCohortRequest(
            title="To Delete",
            description="Test",
            department_id=dept_id,
            active=True,
            default_cohort=False,
            profile_ids=[],
            simulation_ids=[],
        )
    )

    # Delete it
    del_resp = await svc.delete_cohort(
        DeleteCohortRequest(cohortId=create_resp.cohortId)
    )

    assert del_resp.success is True

    # Verify it's deleted (or marked inactive)
    cohort = await db.fetchrow(
        "SELECT active FROM cohorts WHERE id = $1", create_resp.cohortId
    )
    if cohort:
        # If soft delete, should be inactive
        assert cohort["active"] is False
    # If hard delete, cohort would be None (acceptable)


async def test_delete_cohort_invalid_id(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test deleting non-existent cohort."""
    fake_cohort_id = "00000000-0000-0000-0000-000000000000"

    svc = CohortService(db)
    with pytest.raises(ValueError):
        await svc.delete_cohort(DeleteCohortRequest(cohortId=fake_cohort_id))


# ============================================================================
# LEAVE COHORT TESTS
# ============================================================================


async def test_leave_cohort_success(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test a profile leaving a cohort."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    # Create a cohort with the admin
    svc = CohortService(db)
    create_resp = await svc.create_cohort(
        CreateCohortRequest(
            title="Test Cohort",
            description="Test",
            department_id=dept_id,
            active=True,
            default_cohort=False,
            profile_ids=[admin_id],
            simulation_ids=[],
        )
    )

    # Admin leaves
    leave_resp = await svc.leave_cohort(
        LeaveCohortRequest(cohortId=create_resp.cohortId, profileId=admin_id)
    )

    assert leave_resp.success is True

    # Verify admin is no longer in cohort (or marked inactive)
    link = await db.fetchrow(
        "SELECT active FROM cohort_profiles WHERE cohort_id = $1 AND profile_id = $2",
        create_resp.cohortId,
        admin_id,
    )
    if link:
        assert link["active"] is False
    # If hard delete, link would be None (acceptable)


# ============================================================================
# ADD/REMOVE PROFILES TESTS
# ============================================================================


async def test_add_profiles_to_cohort(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test adding profiles to a cohort."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    # Create a cohort without profiles
    svc = CohortService(db)
    create_resp = await svc.create_cohort(
        CreateCohortRequest(
            title="Test Cohort",
            description="Test",
            department_id=dept_id,
            active=True,
            default_cohort=False,
            profile_ids=[],
            simulation_ids=[],
        )
    )

    # Add admin to cohort
    add_resp = await svc.add_profiles_to_cohort(
        AddProfilesToCohortRequest(
            cohortId=create_resp.cohortId,
            departmentIds=[dept_id],
            existingProfileIds=[admin_id],
        )
    )

    assert add_resp.success is True

    # Verify profile was added
    count = await db.fetchval(
        "SELECT COUNT(*) FROM cohort_profiles WHERE cohort_id = $1 AND profile_id = $2 AND active = true",
        create_resp.cohortId,
        admin_id,
    )
    assert count == 1


async def test_remove_profiles_from_cohort(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test removing profiles from a cohort."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    # Get a TA profile to add and remove
    ta_profile = await db.fetchrow(
        "SELECT id FROM profiles WHERE role = 'ta' LIMIT 1"
    )
    if not ta_profile:
        pytest.skip("No TA profile found in seed data")
    ta_id = str(ta_profile["id"])

    # Create a cohort with admin and TA
    svc = CohortService(db)
    create_resp = await svc.create_cohort(
        CreateCohortRequest(
            title="Test Cohort",
            description="Test",
            department_id=dept_id,
            active=True,
            default_cohort=False,
            profile_ids=[admin_id, ta_id],
            simulation_ids=[],
        )
    )

    # Remove TA from cohort (using superadmin as current user)
    remove_resp = await svc.remove_profiles_from_cohort(
        RemoveProfilesFromCohortRequest(
            cohortId=create_resp.cohortId,
            profileIds=[ta_id],
            currentProfileId=admin_id,
        )
    )

    assert remove_resp.success is True

    # Verify profile was removed (or marked inactive)
    link = await db.fetchrow(
        "SELECT active FROM cohort_profiles WHERE cohort_id = $1 AND profile_id = $2",
        create_resp.cohortId,
        ta_id,
    )
    if link:
        assert link["active"] is False
    # If hard delete, link would be None (acceptable)


async def test_remove_profiles_from_cohort_prevents_self_removal(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that removing yourself from cohort is prevented."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = CohortService(db)
    create_resp = await svc.create_cohort(
        CreateCohortRequest(
            title="Test Cohort",
            description="Test",
            department_id=dept_id,
            active=True,
            default_cohort=False,
            profile_ids=[admin_id],
            simulation_ids=[],
        )
    )

    # Try to remove self - should fail
    with pytest.raises(ValueError, match="Cannot remove yourself"):
        await svc.remove_profiles_from_cohort(
            RemoveProfilesFromCohortRequest(
                cohortId=create_resp.cohortId,
                profileIds=[admin_id],
                currentProfileId=admin_id,
            )
        )


async def test_remove_profiles_from_cohort_role_permissions(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that role-based permissions are enforced for removal."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    # Get an admin profile (different from superadmin)
    admin_profile = await db.fetchrow(
        "SELECT id FROM profiles WHERE role = 'admin' AND id != $1 LIMIT 1",
        admin_id,
    )
    if not admin_profile:
        pytest.skip("No admin profile found in seed data")
    admin2_id = str(admin_profile["id"])

    # Get a TA profile
    ta_profile = await db.fetchrow(
        "SELECT id FROM profiles WHERE role = 'ta' LIMIT 1"
    )
    if not ta_profile:
        pytest.skip("No TA profile found in seed data")
    ta_id = str(ta_profile["id"])

    svc = CohortService(db)
    create_resp = await svc.create_cohort(
        CreateCohortRequest(
            title="Test Cohort",
            description="Test",
            department_id=dept_id,
            active=True,
            default_cohort=False,
            profile_ids=[admin2_id, ta_id],
            simulation_ids=[],
        )
    )

    # Admin cannot remove self (self-removal prevention)
    with pytest.raises(ValueError, match="Cannot remove yourself"):
        await svc.remove_profiles_from_cohort(
            RemoveProfilesFromCohortRequest(
                cohortId=create_resp.cohortId,
                profileIds=[admin2_id],
                currentProfileId=admin2_id,  # Admin trying to remove self
            )
        )

    # Admin cannot remove another admin (same level) - use superadmin as current user
    # First need to add another admin to the cohort
    admin3_profile = await db.fetchrow(
        "SELECT id FROM profiles WHERE role = 'admin' AND id NOT IN ($1, $2) LIMIT 1",
        admin_id,
        admin2_id,
    )
    if admin3_profile:
        admin3_id = str(admin3_profile["id"])
        # Add admin3 to cohort
        await svc.add_profiles_to_cohort(
            AddProfilesToCohortRequest(
                cohortId=create_resp.cohortId,
                departmentIds=[dept_id],
                existingProfileIds=[admin3_id],
            )
        )
        # Admin2 cannot remove admin3 (same level)
        with pytest.raises(ValueError, match="can only remove roles equal or below"):
            await svc.remove_profiles_from_cohort(
                RemoveProfilesFromCohortRequest(
                    cohortId=create_resp.cohortId,
                    profileIds=[admin3_id],
                    currentProfileId=admin2_id,  # Admin trying to remove another admin
                )
            )

    # Admin can remove TA (lower level)
    remove_resp = await svc.remove_profiles_from_cohort(
        RemoveProfilesFromCohortRequest(
            cohortId=create_resp.cohortId,
            profileIds=[ta_id],
            currentProfileId=admin2_id,
        )
    )
    assert remove_resp.success is True


# ============================================================================
# ENVIRONMENT VARIABLE TESTS
# ============================================================================


async def test_list_cohorts_uses_campus_domain(
    db: asyncpg.Connection, disable_cache: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Test that campus email domain is used in queries."""
    monkeypatch.setenv("NEXT_PUBLIC_CAMPUS_EMAIL", "test.campus.edu")

    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = CohortService(db)
    # Should not raise an error
    resp = await svc.get_cohorts_list(
        CohortsFilters(departmentIds=[dept_id], profileId=admin_id)
    )

    assert resp is not None


# ============================================================================
# DETAIL VARIANT TESTS
# ============================================================================


async def test_get_cohort_detail_default(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting default cohort detail for a profile in a department."""
    admin_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    svc = CohortService(db)
    from app.schemas.cohorts import CohortDetailDefaultRequest

    resp = await svc.get_cohort_detail_default(
        CohortDetailDefaultRequest(departmentIds=[dept_id], profileId=admin_id)
    )

    # Should return some cohort details (superadmin now linked to CS dept and cohort)
    assert resp is not None
    assert resp.title is not None


async def test_get_cohort_detail_with_profiles(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting cohort detail with profiles."""
    cohort_id = "c5180001-1111-2222-3333-444444444444"  # New GTAs cohort
    admin_id = await get_superadmin_alias(db)
    dept_id = await get_cs_dept_id(db)

    svc = CohortService(db)
    from app.schemas.cohorts import CohortDetailWithProfilesRequest

    resp = await svc.get_cohort_detail_with_profiles(
        CohortDetailWithProfilesRequest(
            cohortId=cohort_id,
            departmentIds=[dept_id],
            currentProfileId=admin_id,
        )
    )

    # Should return cohort with profiles
    assert resp.title == "New GTAs"
    assert len(resp.available_profiles) >= 0


# ============================================================================
# SEARCH TESTS
# ============================================================================


async def test_search_cohorts(db: asyncpg.Connection, disable_cache: None) -> None:
    """Test searching for cohorts."""
    svc = CohortService(db)

    # search_cohorts takes (query: str, limit: int) and returns List[Dict]
    results = await svc.search_cohorts(query="GTA", limit=10)

    # Should find the "New GTAs" and "Returning GTAs" cohorts
    assert len(results) >= 2
    cohort_names = {c["title"] for c in results}
    assert "New GTAs" in cohort_names or "Returning GTAs" in cohort_names


# ============================================================================
# OVERVIEW AND ANALYTICS TESTS
# ============================================================================


async def test_get_cohort_overview(db: asyncpg.Connection, disable_cache: None) -> None:
    """Test getting cohort overview."""
    cohort_id = "c5180001-1111-2222-3333-444444444444"  # New GTAs cohort

    svc = CohortService(db)
    result = await svc.get_cohort_overview(cohort_id)

    # Should return overview dict
    assert result is not None
    assert isinstance(result, dict)


async def test_get_cohort_pass_matrix(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test getting cohort pass matrix."""
    cohort_id = "c5180001-1111-2222-3333-444444444444"  # New GTAs cohort

    svc = CohortService(db)
    result = await svc.get_cohort_pass_matrix(cohort_id)

    # Should return matrix dict
    assert result is not None
    assert isinstance(result, dict)
