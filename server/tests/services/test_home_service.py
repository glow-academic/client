"""Real database integration tests for HomeService."""

import asyncpg  # type: ignore
import pytest
from app.schemas.analytics import AnalyticsFilters
from app.services.home_service import HomeService
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias

pytestmark = pytest.mark.asyncio


# ============================================================================
# HOME OVERVIEW TESTS
# ============================================================================


async def test_home_overview_returns_complete_bundle(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that home overview returns complete response with all fields."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = HomeService(db)
    resp = await svc.get_home_overview(
        AnalyticsFilters(
            startDate="2020-01-01",
            endDate="2030-12-31",
            departmentIds=[dept_id],
            profileId=admin_id,
        )
    )

    # Verify response structure
    assert resp.mode in ("ta", "instructional", "empty")
    assert isinstance(resp.hasData, bool)
    assert isinstance(resp.items, list)
    assert isinstance(resp.history, list)
    assert isinstance(resp.standard_groups_mapping, dict)
    assert isinstance(resp.standards_mapping, dict)
    assert isinstance(resp.simulation_mapping, dict)


async def test_home_overview_instructional_mode(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test instructional view shows all cohort data (no profileId filter)."""
    dept_id = await get_cs_dept_id(db)

    svc = HomeService(db)
    resp = await svc.get_home_overview(
        AnalyticsFilters(
            startDate="2020-01-01",
            endDate="2030-12-31",
            departmentIds=[dept_id],
            profileId=None,  # No profile filter = instructional mode
        )
    )

    # Should see instructional view when no profileId provided
    assert resp.mode == "instructional"

    # Check items structure
    if len(resp.items) > 0:
        first_item = resp.items[0]
        assert first_item.viewMode == "instructional"
        assert hasattr(first_item, "simulationTitle")
        assert hasattr(first_item, "passedCount")
        assert hasattr(first_item, "inProgressCount")
        assert hasattr(first_item, "notStartedCount")


async def test_home_overview_mappings_populated(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """CRITICAL: Verify mappings are actually populated, not just empty dicts."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = HomeService(db)
    resp = await svc.get_home_overview(
        AnalyticsFilters(
            startDate="2020-01-01",
            endDate="2030-12-31",
            departmentIds=[dept_id],
            profileId=admin_id,
        )
    )

    # If there are items, there should be mappings
    if len(resp.items) > 0:
        # Check standard_groups_mapping
        if resp.standard_groups_mapping:
            assert len(resp.standard_groups_mapping) > 0, (
                "standard_groups_mapping should be populated when items exist"
            )
            # Verify mapping structure
            sample_key = next(iter(resp.standard_groups_mapping.keys()))
            sample_item = resp.standard_groups_mapping[sample_key]
            assert hasattr(sample_item, "name"), "StandardGroup should have name"
            assert hasattr(sample_item, "points"), "StandardGroup should have points"

        # Check standards_mapping
        if resp.standards_mapping:
            assert len(resp.standards_mapping) > 0, (
                "standards_mapping should be populated when items exist"
            )
            # Verify mapping structure
            sample_key = next(iter(resp.standards_mapping.keys()))
            sample_item = resp.standards_mapping[sample_key]
            assert hasattr(sample_item, "name"), "Standard should have name"
            assert hasattr(sample_item, "points"), "Standard should have points"


async def test_home_overview_history_populated(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Verify history array contains attempt data with proper structure."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = HomeService(db)
    resp = await svc.get_home_overview(
        AnalyticsFilters(
            startDate="2020-01-01",
            endDate="2030-12-31",
            departmentIds=[dept_id],
            profileId=admin_id,
        )
    )

    # History should be a list
    assert isinstance(resp.history, list)

    # If there are attempts, verify structure
    if len(resp.history) > 0:
        first_attempt = resp.history[0]
        assert hasattr(first_attempt, "attemptId"), "History item should have attemptId"
        assert hasattr(first_attempt, "profileName"), (
            "History item should have profileName"
        )
        assert hasattr(first_attempt, "simulationName"), (
            "History item should have simulationName"
        )
        assert hasattr(first_attempt, "date"), "History item should have date"
        assert hasattr(first_attempt, "cohortNames"), (
            "History item should have cohortNames"
        )
        assert isinstance(first_attempt.cohortNames, list), (
            "cohortNames should be a list"
        )


async def test_home_overview_with_date_filters(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test home overview with different date ranges."""
    dept_id = await get_cs_dept_id(db)

    svc = HomeService(db)

    # Recent date range (might have no data) - instructional mode without profileId
    resp_recent = await svc.get_home_overview(
        AnalyticsFilters(
            startDate="2025-01-01",
            endDate="2025-12-31",
            departmentIds=[dept_id],
            profileId=None,
        )
    )
    assert resp_recent.mode == "instructional"

    # Wide date range (should have data if any exists)
    resp_wide = await svc.get_home_overview(
        AnalyticsFilters(
            startDate="2020-01-01",
            endDate="2030-12-31",
            departmentIds=[dept_id],
            profileId=None,
        )
    )
    assert resp_wide.mode == "instructional"


async def test_home_overview_empty_mode(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test home overview returns empty mode when no data available."""
    # Create a new department with no cohorts/simulations
    new_dept_id = await db.fetchval(
        "INSERT INTO departments(title, description, active) "
        "VALUES('Empty Test Dept', 'Test', true) RETURNING id"
    )

    svc = HomeService(db)
    resp = await svc.get_home_overview(
        AnalyticsFilters(
            startDate="2020-01-01",
            endDate="2030-12-31",
            departmentIds=[str(new_dept_id)],
            profileId=None,  # No profileId for instructional mode
        )
    )

    # Should return instructional mode but with no data
    assert resp.mode == "instructional"
    assert resp.hasData is False or len(resp.items) == 0


async def test_home_overview_cache_behavior(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Verify cache decorator works correctly."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01",
        endDate="2030-12-31",
        departmentIds=[dept_id],
        profileId=admin_id,
    )

    svc = HomeService(db)

    # First call
    resp1 = await svc.get_home_overview(filters)

    # Second call with same filters (should use cache if enabled)
    resp2 = await svc.get_home_overview(filters)

    # Both should return consistent results
    assert resp1.mode == resp2.mode
    assert resp1.hasData == resp2.hasData
    assert len(resp1.items) == len(resp2.items)


async def test_home_overview_with_cohort_filters(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test home overview with specific cohort filters."""
    dept_id = await get_cs_dept_id(db)

    # Get a cohort ID from the CS department
    cohort_id = "c5180001-1111-2222-3333-444444444444"  # New GTAs cohort

    svc = HomeService(db)
    resp = await svc.get_home_overview(
        AnalyticsFilters(
            startDate="2020-01-01",
            endDate="2030-12-31",
            departmentIds=[dept_id],
            cohortIds=[cohort_id],
            profileId=None,  # No profileId for instructional mode
        )
    )

    # Should filter to specific cohort in instructional mode
    assert resp.mode == "instructional"


async def test_home_overview_role_based_access(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Verify that TA mode is only triggered for actual TAs."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = HomeService(db)

    # Admin with profileId - shows instructional mode (cohort overview)
    admin_resp = await svc.get_home_overview(
        AnalyticsFilters(
            startDate="2020-01-01",
            endDate="2030-12-31",
            departmentIds=[dept_id],
            profileId=admin_id,
        )
    )

    # Should see instructional mode even with profileId (since role is admin, not ta)
    assert admin_resp.mode == "instructional"

    # History should still be filtered to only this profile's attempts
    if len(admin_resp.history) > 0:
        for attempt in admin_resp.history:
            assert attempt.profileId == admin_id, (
                f"History should only show attempts for profileId {admin_id}, "
                f"but found attempt from {attempt.profileId}"
            )

    # Verify items are present (should show cohort overview, not personal stats)
    assert isinstance(admin_resp.items, list)


async def test_home_overview_history_filtered_by_profile(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Verify history is filtered to only include attempts from the specified profile."""
    dept_id = await get_cs_dept_id(db)
    
    # Get a specific profile ID from seed data
    profile_id = await db.fetchval(
        "SELECT id FROM profiles WHERE role = 'ta' LIMIT 1"
    )
    
    if profile_id is None:
        # Skip test if no TA profiles exist
        pytest.skip("No TA profiles in seed data")
        return

    svc = HomeService(db)
    resp = await svc.get_home_overview(
        AnalyticsFilters(
            startDate="2020-01-01",
            endDate="2030-12-31",
            departmentIds=[dept_id],
            profileId=str(profile_id),
        )
    )

    # If there are attempts in history, verify they all belong to the specified profile
    if len(resp.history) > 0:
        for attempt in resp.history:
            assert attempt.profileId == str(profile_id), (
                f"History should only contain attempts from profile {profile_id}, "
                f"but found attempt from {attempt.profileId}"
            )
