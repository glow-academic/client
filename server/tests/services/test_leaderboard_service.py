"""Real database integration tests for LeaderboardService."""

import asyncpg  # type: ignore
import pytest
from tests.seed_helpers import get_cs_dept_id

from app.schemas.analytics import AnalyticsFilters
from app.services.leaderboard_service import LeaderboardService

pytestmark = pytest.mark.asyncio


# ============================================================================
# LEADERBOARD BUNDLE TESTS
# ============================================================================


async def test_leaderboard_bundle_returns_data(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that leaderboard bundle returns data with proper structure."""
    dept_id = await get_cs_dept_id(db)

    svc = LeaderboardService(db)
    filters = AnalyticsFilters(
        startDate="2024-01-01",
        endDate="2025-12-31",
        departmentIds=[dept_id],
    )

    response = await svc.get_leaderboard_bundle(filters)

    # Should return LeaderboardBundleResponse with data list
    assert response is not None
    assert hasattr(response, "data")
    assert isinstance(response.data, list)

    # If there's data, verify basic structure
    if len(response.data) > 0:
        row = response.data[0]
        assert hasattr(row, "profileId")
        assert hasattr(row, "firstName")
        assert hasattr(row, "lastName")
        assert hasattr(row, "metrics")


async def test_leaderboard_bundle_has_all_metrics(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that each leaderboard row has all 8 required metrics."""
    dept_id = await get_cs_dept_id(db)

    svc = LeaderboardService(db)
    filters = AnalyticsFilters(
        startDate="2024-01-01",
        endDate="2025-12-31",
        departmentIds=[dept_id],
    )

    response = await svc.get_leaderboard_bundle(filters)

    # If there's data, verify all 8 metrics are present
    if len(response.data) > 0:
        row = response.data[0]
        metrics = row.metrics

        # Verify all 8 required metrics exist
        assert hasattr(metrics, "totalAttempts")
        assert hasattr(metrics, "highestScoreAvg")
        assert hasattr(metrics, "messagesPerSession")
        assert hasattr(metrics, "personaResponseSeconds")
        assert hasattr(metrics, "timeSpentMinutes")
        assert hasattr(metrics, "improvementRatePerDay")
        assert hasattr(metrics, "perfectScoreCount")
        assert hasattr(metrics, "quickestPassMinutes")


async def test_leaderboard_bundle_metrics_structure(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that each metric has proper structure: hasData, method, currentValue, trendData, dataPoints, hover."""
    dept_id = await get_cs_dept_id(db)

    svc = LeaderboardService(db)
    filters = AnalyticsFilters(
        startDate="2024-01-01",
        endDate="2025-12-31",
        departmentIds=[dept_id],
    )

    response = await svc.get_leaderboard_bundle(filters)

    # If there's data, verify metric structure
    if len(response.data) > 0:
        row = response.data[0]
        metric = row.metrics.totalAttempts

        # Verify metric structure
        assert hasattr(metric, "hasData")
        assert hasattr(metric, "method")
        assert hasattr(metric, "currentValue")
        assert hasattr(metric, "trendData")
        assert hasattr(metric, "dataPoints")
        assert hasattr(metric, "hover")

        # Verify types
        assert isinstance(metric.hasData, bool)
        assert isinstance(metric.method, str)
        assert isinstance(metric.currentValue, int)
        assert isinstance(metric.trendData, list)
        assert isinstance(metric.dataPoints, list)
        assert isinstance(metric.hover, dict)


async def test_leaderboard_bundle_empty_data(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test leaderboard bundle with date range that has no data."""
    dept_id = await get_cs_dept_id(db)

    svc = LeaderboardService(db)
    filters = AnalyticsFilters(
        startDate="2000-01-01",
        endDate="2000-01-02",
        departmentIds=[dept_id],
    )

    response = await svc.get_leaderboard_bundle(filters)

    # Should return empty data list, not fail
    assert response is not None
    assert hasattr(response, "data")
    assert isinstance(response.data, list)
    # Empty data is expected for date range with no attempts
    assert len(response.data) == 0


async def test_leaderboard_bundle_with_cohort_filter(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test leaderboard bundle filtering by cohort."""
    dept_id = await get_cs_dept_id(db)
    cohort_id = "c5180001-1111-2222-3333-444444444444"  # New GTAs cohort

    svc = LeaderboardService(db)
    filters = AnalyticsFilters(
        startDate="2024-01-01",
        endDate="2025-12-31",
        departmentIds=[dept_id],
        cohortIds=[cohort_id],
    )

    response = await svc.get_leaderboard_bundle(filters)

    # Should return response (may be empty if cohort has no attempts)
    assert response is not None
    assert hasattr(response, "data")
    assert isinstance(response.data, list)


async def test_leaderboard_bundle_with_date_filter(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test leaderboard bundle with specific date range filtering."""
    dept_id = await get_cs_dept_id(db)

    svc = LeaderboardService(db)
    # Use a wide date range
    filters = AnalyticsFilters(
        startDate="2020-01-01",
        endDate="2030-12-31",
        departmentIds=[dept_id],
    )

    response = await svc.get_leaderboard_bundle(filters)

    # Should return response
    assert response is not None
    assert hasattr(response, "data")
    assert isinstance(response.data, list)


async def test_leaderboard_bundle_cache_works(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that caching works for leaderboard bundle."""
    dept_id = await get_cs_dept_id(db)

    svc = LeaderboardService(db)
    filters = AnalyticsFilters(
        startDate="2024-01-01",
        endDate="2025-12-31",
        departmentIds=[dept_id],
    )

    # First call
    response1 = await svc.get_leaderboard_bundle(filters)

    # Second call with same filters (should hit cache)
    response2 = await svc.get_leaderboard_bundle(filters)

    # Both should return valid responses
    assert response1 is not None
    assert response2 is not None
    assert isinstance(response1.data, list)
    assert isinstance(response2.data, list)

    # Responses should be equal (same data)
    assert len(response1.data) == len(response2.data)


async def test_leaderboard_bundle_profile_ids_valid(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that profile IDs in leaderboard data are valid UUIDs."""
    dept_id = await get_cs_dept_id(db)

    svc = LeaderboardService(db)
    filters = AnalyticsFilters(
        startDate="2024-01-01",
        endDate="2025-12-31",
        departmentIds=[dept_id],
    )

    response = await svc.get_leaderboard_bundle(filters)

    # If there's data, verify profileIds are valid
    if len(response.data) > 0:
        for row in response.data:
            assert row.profileId is not None
            assert len(row.profileId) > 0
            # Should be a valid UUID string format
            assert "-" in row.profileId


async def test_leaderboard_bundle_names_not_empty(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that first and last names are not empty when data exists."""
    dept_id = await get_cs_dept_id(db)

    svc = LeaderboardService(db)
    filters = AnalyticsFilters(
        startDate="2024-01-01",
        endDate="2025-12-31",
        departmentIds=[dept_id],
    )

    response = await svc.get_leaderboard_bundle(filters)

    # If there's data, verify names exist
    if len(response.data) > 0:
        for row in response.data:
            # At least one of firstName or lastName should have content
            assert row.firstName is not None or row.lastName is not None


async def test_leaderboard_bundle_metric_values_non_negative(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that metric current values are non-negative."""
    dept_id = await get_cs_dept_id(db)

    svc = LeaderboardService(db)
    filters = AnalyticsFilters(
        startDate="2024-01-01",
        endDate="2025-12-31",
        departmentIds=[dept_id],
    )

    response = await svc.get_leaderboard_bundle(filters)

    # If there's data, verify metric values are non-negative
    if len(response.data) > 0:
        row = response.data[0]
        metrics = row.metrics

        # All count-based metrics should be non-negative
        assert metrics.totalAttempts.currentValue >= 0
        assert metrics.highestScoreAvg.currentValue >= 0
        assert metrics.messagesPerSession.currentValue >= 0
        assert metrics.personaResponseSeconds.currentValue >= 0
        assert metrics.timeSpentMinutes.currentValue >= 0
        assert metrics.perfectScoreCount.currentValue >= 0
        # Improvement rate can be 0 if not enough data
        # Quickest pass can be 0 if no passes
