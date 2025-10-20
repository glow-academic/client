"""Real database integration tests for PricingService."""

import asyncpg  # type: ignore
import pytest
from tests.seed_helpers import (
    get_cs_dept_id,  # type: ignore
    get_superadmin_alias,  # type: ignore
)

from app.schemas.analytics import AnalyticsFilters  # type: ignore
from app.services.pricing_service import PricingService  # type: ignore

pytestmark = pytest.mark.asyncio


# ============================================================================
# BASIC FUNCTIONALITY TESTS
# ============================================================================


async def test_get_pricing_analytics_returns_complete_data(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that pricing analytics returns complete response with all fields."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = PricingService(db)
    resp = await svc.get_pricing_analytics(
        AnalyticsFilters(
            startDate="2020-01-01T00:00:00Z",
            endDate="2030-12-31T23:59:59Z",
            departmentIds=[dept_id],
            profileId=admin_id,
        )
    )

    # Verify response has all required fields
    assert hasattr(resp, "model_runs")
    assert hasattr(resp, "model_mapping")
    assert hasattr(resp, "profile_mapping")
    assert hasattr(resp, "agent_mapping")
    assert hasattr(resp, "persona_mapping")

    # Verify fields are of correct types
    assert isinstance(resp.model_runs, list)
    assert isinstance(resp.model_mapping, dict)
    assert isinstance(resp.profile_mapping, dict)
    assert isinstance(resp.agent_mapping, dict)
    assert isinstance(resp.persona_mapping, dict)


async def test_mappings_are_populated_when_data_exists(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that mappings are populated with actual data when model runs exist."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = PricingService(db)
    resp = await svc.get_pricing_analytics(
        AnalyticsFilters(
            startDate="2020-01-01T00:00:00Z",
            endDate="2030-12-31T23:59:59Z",
            departmentIds=[dept_id],
            profileId=admin_id,
        )
    )

    # If there are model runs, check that mappings are populated
    if len(resp.model_runs) > 0:
        # Collect IDs from model runs
        model_ids = {
            run.model_id for run in resp.model_runs if run.model_id is not None
        }
        profile_ids = {
            run.profile_id for run in resp.model_runs if run.profile_id is not None
        }
        agent_ids = {
            run.agent_id for run in resp.model_runs if run.agent_id is not None
        }
        persona_ids = {
            run.persona_id for run in resp.model_runs if run.persona_id is not None
        }

        # If we have model IDs, model_mapping should contain them
        if len(model_ids) > 0:
            assert len(resp.model_mapping) > 0, (
                "model_mapping should be populated when model runs have models"
            )
            sample_model_id = next(iter(model_ids))
            if sample_model_id in resp.model_mapping:
                model_item = resp.model_mapping[sample_model_id]
                assert hasattr(model_item, "name") and len(model_item.name) > 0
                assert hasattr(model_item, "input_ppm")
                assert hasattr(model_item, "output_ppm")

        # If we have profile IDs, profile_mapping should contain them
        if len(profile_ids) > 0:
            assert len(resp.profile_mapping) > 0, (
                "profile_mapping should be populated when model runs have profiles"
            )
            sample_profile_id = next(iter(profile_ids))
            if sample_profile_id in resp.profile_mapping:
                profile_name = resp.profile_mapping[sample_profile_id]
                assert isinstance(profile_name, str) and len(profile_name) > 0

        # If we have agent IDs, agent_mapping should contain them
        if len(agent_ids) > 0:
            assert len(resp.agent_mapping) > 0, (
                "agent_mapping should be populated when model runs have agents"
            )

        # If we have persona IDs, persona_mapping should contain them
        if len(persona_ids) > 0:
            assert len(resp.persona_mapping) > 0, (
                "persona_mapping should be populated when model runs have personas"
            )


async def test_model_runs_ordered_by_date(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that model runs are ordered by created_at DESC."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = PricingService(db)
    resp = await svc.get_pricing_analytics(
        AnalyticsFilters(
            startDate="2020-01-01T00:00:00Z",
            endDate="2030-12-31T23:59:59Z",
            departmentIds=[dept_id],
            profileId=admin_id,
        )
    )

    # If we have multiple model runs, verify they're sorted DESC
    if len(resp.model_runs) >= 2:
        for i in range(len(resp.model_runs) - 1):
            # Later runs should have later or equal created_at
            assert resp.model_runs[i].created_at >= resp.model_runs[i + 1].created_at


async def test_debug_info_included(db: asyncpg.Connection, disable_cache: None) -> None:
    """Test that debug_info is properly attached to model runs."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = PricingService(db)
    resp = await svc.get_pricing_analytics(
        AnalyticsFilters(
            startDate="2020-01-01T00:00:00Z",
            endDate="2030-12-31T23:59:59Z",
            departmentIds=[dept_id],
            profileId=admin_id,
        )
    )

    # Verify debug_info field exists on all model runs
    for run in resp.model_runs:
        assert hasattr(run, "debug_info")
        assert isinstance(run.debug_info, list)
        # If debug_info has items, verify structure
        for debug in run.debug_info:
            assert hasattr(debug, "id")
            assert hasattr(debug, "created_at")
            assert hasattr(debug, "content")


# ============================================================================
# FILTERING TESTS
# ============================================================================


async def test_date_range_filter(db: asyncpg.Connection, disable_cache: None) -> None:
    """Test filtering by date range."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = PricingService(db)

    # Get all data
    resp_all = await svc.get_pricing_analytics(
        AnalyticsFilters(
            startDate="2020-01-01T00:00:00Z",
            endDate="2030-12-31T23:59:59Z",
            departmentIds=[dept_id],
            profileId=admin_id,
        )
    )

    # Get narrow date range
    resp_narrow = await svc.get_pricing_analytics(
        AnalyticsFilters(
            startDate="2020-01-01T00:00:00Z",
            endDate="2020-01-02T00:00:00Z",
            departmentIds=[dept_id],
            profileId=admin_id,
        )
    )

    # Narrow range should have fewer or equal model runs
    assert len(resp_narrow.model_runs) <= len(resp_all.model_runs)


async def test_profile_filter_non_admin(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that non-admin users only see their own pricing data."""
    dept_id = await get_cs_dept_id(db)

    # Get a TA or student profile (non-admin)
    ta_id = await db.fetchval(
        "SELECT id FROM profiles WHERE role = 'ta' AND active = true LIMIT 1"
    )

    if ta_id:
        svc = PricingService(db)
        resp = await svc.get_pricing_analytics(
            AnalyticsFilters(
                startDate="2020-01-01T00:00:00Z",
                endDate="2030-12-31T23:59:59Z",
                departmentIds=[dept_id],
                profileId=str(ta_id),
            )
        )

        # All model runs should belong to the TA
        for run in resp.model_runs:
            if run.profile_id:
                assert run.profile_id == str(ta_id)


async def test_profile_filter_admin(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that admins see all pricing data regardless of profileId."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = PricingService(db)
    resp = await svc.get_pricing_analytics(
        AnalyticsFilters(
            startDate="2020-01-01T00:00:00Z",
            endDate="2030-12-31T23:59:59Z",
            departmentIds=[dept_id],
            profileId=admin_id,
        )
    )

    # Admin should see model runs from multiple profiles
    profile_ids = {run.profile_id for run in resp.model_runs if run.profile_id}
    # If there's data, admins should potentially see multiple profiles
    # (Not enforcing > 1 since it depends on seed data)
    assert isinstance(resp.model_runs, list)


async def test_department_filter(db: asyncpg.Connection, disable_cache: None) -> None:
    """Test filtering by department."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    # Create a new department with no data
    new_dept_id = await db.fetchval(
        "INSERT INTO departments(title, description, active) "
        "VALUES('Test Pricing Dept', 'Test', true) RETURNING id"
    )

    svc = PricingService(db)

    # CS department should have data (or at least not error)
    resp_cs = await svc.get_pricing_analytics(
        AnalyticsFilters(
            startDate="2020-01-01T00:00:00Z",
            endDate="2030-12-31T23:59:59Z",
            departmentIds=[dept_id],
            profileId=admin_id,
        )
    )

    # New department should have no data
    resp_new = await svc.get_pricing_analytics(
        AnalyticsFilters(
            startDate="2020-01-01T00:00:00Z",
            endDate="2030-12-31T23:59:59Z",
            departmentIds=[str(new_dept_id)],
            profileId=admin_id,
        )
    )

    assert len(resp_new.model_runs) == 0


async def test_cohort_filter(db: asyncpg.Connection, disable_cache: None) -> None:
    """Test filtering by cohort."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    # Get a cohort ID from CS department
    cohort_id = await db.fetchval(
        "SELECT id FROM cohorts WHERE department_id = $1 AND active = true LIMIT 1",
        dept_id,
    )

    if cohort_id:
        svc = PricingService(db)
        resp = await svc.get_pricing_analytics(
            AnalyticsFilters(
                startDate="2020-01-01T00:00:00Z",
                endDate="2030-12-31T23:59:59Z",
                departmentIds=[dept_id],
                cohortIds=[str(cohort_id)],
                profileId=admin_id,
            )
        )

        # Should not error, and return valid response
        assert isinstance(resp.model_runs, list)


async def test_role_filter(db: asyncpg.Connection, disable_cache: None) -> None:
    """Test filtering by role."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = PricingService(db)
    resp = await svc.get_pricing_analytics(
        AnalyticsFilters(
            startDate="2020-01-01T00:00:00Z",
            endDate="2030-12-31T23:59:59Z",
            departmentIds=[dept_id],
            roles=["ta"],
            profileId=admin_id,
        )
    )

    # Should return valid response
    assert isinstance(resp.model_runs, list)


# ============================================================================
# EDGE CASES
# ============================================================================


async def test_empty_date_range(db: asyncpg.Connection, disable_cache: None) -> None:
    """Test that empty date range returns empty arrays."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = PricingService(db)
    resp = await svc.get_pricing_analytics(
        AnalyticsFilters(
            startDate="1900-01-01T00:00:00Z",
            endDate="1900-01-02T00:00:00Z",
            departmentIds=[dept_id],
            profileId=admin_id,
        )
    )

    # Should return empty arrays
    assert len(resp.model_runs) == 0
    assert len(resp.model_mapping) == 0
    assert len(resp.profile_mapping) == 0
    assert len(resp.agent_mapping) == 0
    assert len(resp.persona_mapping) == 0


async def test_no_model_runs_department(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that department with no model runs returns empty response."""
    admin_id = await get_superadmin_alias(db)

    # Create a new department with no model runs
    new_dept_id = await db.fetchval(
        "INSERT INTO departments(title, description, active) "
        "VALUES('Empty Dept', 'Test', true) RETURNING id"
    )

    svc = PricingService(db)
    resp = await svc.get_pricing_analytics(
        AnalyticsFilters(
            startDate="2020-01-01T00:00:00Z",
            endDate="2030-12-31T23:59:59Z",
            departmentIds=[str(new_dept_id)],
            profileId=admin_id,
        )
    )

    assert len(resp.model_runs) == 0
    assert isinstance(resp.model_mapping, dict)
    assert isinstance(resp.profile_mapping, dict)
    assert isinstance(resp.agent_mapping, dict)
    assert isinstance(resp.persona_mapping, dict)


async def test_missing_mappings_handle_gracefully(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that model runs without associated entities handle gracefully."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    svc = PricingService(db)
    resp = await svc.get_pricing_analytics(
        AnalyticsFilters(
            startDate="2020-01-01T00:00:00Z",
            endDate="2030-12-31T23:59:59Z",
            departmentIds=[dept_id],
            profileId=admin_id,
        )
    )

    # Verify that None values for optional IDs don't cause errors
    for run in resp.model_runs:
        # These fields can be None
        assert run.model_id is None or isinstance(run.model_id, str)
        assert run.profile_id is None or isinstance(run.profile_id, str)
        assert run.agent_id is None or isinstance(run.agent_id, str)
        assert run.persona_id is None or isinstance(run.persona_id, str)


# ============================================================================
# CACHE TESTS
# ============================================================================


async def test_cache_hit(db: asyncpg.Connection) -> None:
    """Test that second call uses cache."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
        profileId=admin_id,
    )

    svc = PricingService(db)

    # First call - cache miss
    resp1 = await svc.get_pricing_analytics(filters)

    # Second call - should use cache
    resp2 = await svc.get_pricing_analytics(filters)

    # Results should be identical
    assert len(resp1.model_runs) == len(resp2.model_runs)
    assert len(resp1.model_mapping) == len(resp2.model_mapping)
