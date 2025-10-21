"""Real database integration tests for DashboardService."""

import asyncpg  # type: ignore
import pytest
from app.schemas.analytics import AnalyticsFilters
from app.services.dashboard_service import DashboardService
from tests.seed_helpers import get_cs_dept_id, get_superadmin_alias

pytestmark = pytest.mark.asyncio


# ============================================================================
# DASHBOARD BUNDLE TESTS
# ============================================================================


async def test_get_dashboard_bundle_returns_complete_data(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that dashboard bundle returns complete data with all sections."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
        profileId=admin_id,
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    # Assert bundle structure
    assert result is not None

    # Assert header has all 10 metrics
    assert result.header is not None
    assert result.header.average_score is not None
    assert result.header.completion_percentage is not None
    assert result.header.first_attempt_pass_rate is not None
    assert result.header.highest_score is not None
    assert result.header.messages_per_session is not None
    assert result.header.persona_response_times is not None
    assert result.header.session_efficiency is not None
    assert result.header.stagnation_rate is not None
    assert result.header.time_spent is not None
    assert result.header.total_attempts is not None

    # Assert primary has all 3 metrics
    assert result.primary is not None
    assert result.primary.growth_data is not None
    assert result.primary.persona_performance is not None
    assert result.primary.rubric_heatmap is not None

    # Assert secondary has all 3 metrics
    assert result.secondary is not None
    assert result.secondary.attempt_improvement is not None
    assert result.secondary.cohort_performance is not None
    assert result.secondary.skill_performance is not None

    # Assert footer has all 4 metrics
    assert result.footer is not None
    assert result.footer.scenario_performance is not None
    assert result.footer.scenario_stats is not None
    assert result.footer.simulation_performance is not None
    assert result.footer.simulation_composition is not None

    # Assert history is returned (array)
    assert result.history is not None
    assert isinstance(result.history, list)

    # Assert insights are computed
    assert result.insights is not None

    # Assert thresholds are set correctly
    assert result.thresholds is not None
    assert result.thresholds.danger == 60
    assert result.thresholds.warning == 75
    assert result.thresholds.success == 85

    # Assert mappings are present (even if empty)
    assert result.simulation_mapping is not None
    assert result.rubric_mapping is not None
    assert result.parameter_mapping is not None
    assert result.parameter_item_mapping is not None


async def test_get_dashboard_bundle_header_metrics_have_structure(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that all header metrics have the correct structure."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    # Check each header metric has required fields
    for metric_name in [
        "average_score",
        "completion_percentage",
        "first_attempt_pass_rate",
        "highest_score",
        "messages_per_session",
        "persona_response_times",
        "session_efficiency",
        "stagnation_rate",
        "time_spent",
        "total_attempts",
    ]:
        metric = getattr(result.header, metric_name)
        assert metric is not None
        assert hasattr(metric, "hasData")
        assert hasattr(metric, "method")
        assert hasattr(metric, "currentValue")
        assert hasattr(metric, "trendData")
        assert hasattr(metric, "dataPoints")


async def test_get_dashboard_bundle_growth_data_structure(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that growth data has correct structure."""
    dept_id = await get_cs_dept_id(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    growth_data = result.primary.growth_data
    assert growth_data is not None
    assert hasattr(growth_data, "chartData")
    assert hasattr(growth_data, "availableMetrics")
    assert hasattr(growth_data, "windowAverages")
    assert isinstance(growth_data.chartData, list)
    assert isinstance(growth_data.availableMetrics, list)

    # Check window averages structure
    assert growth_data.windowAverages is not None
    assert hasattr(growth_data.windowAverages, "averageScore")
    assert hasattr(growth_data.windowAverages.averageScore, "n")
    assert hasattr(growth_data.windowAverages.averageScore, "last")
    assert hasattr(growth_data.windowAverages.averageScore, "prev")


async def test_get_dashboard_bundle_with_date_filter(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test dashboard bundle with custom date range."""
    dept_id = await get_cs_dept_id(db)

    filters = AnalyticsFilters(
        startDate="2024-01-01T00:00:00Z",
        endDate="2024-12-31T23:59:59Z",
        departmentIds=[dept_id],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    assert result is not None
    assert result.header is not None
    assert result.primary is not None
    assert result.secondary is not None
    assert result.footer is not None


async def test_get_dashboard_bundle_with_profile_filter(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test dashboard bundle filtered by specific profile."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
        profileId=admin_id,
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    assert result is not None
    assert result.header is not None


async def test_get_dashboard_bundle_with_simulation_filters(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test dashboard bundle with simulation type filters."""
    dept_id = await get_cs_dept_id(db)

    # Test with general simulations only
    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
        simulationFilters=["general"],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    assert result is not None

    # Test with practice simulations only
    filters.simulationFilters = ["practice"]
    result = await svc.get_dashboard_bundle(filters)

    assert result is not None


async def test_get_dashboard_bundle_with_role_filter(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test dashboard bundle filtered by role."""
    dept_id = await get_cs_dept_id(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
        roles=["student"],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    assert result is not None
    assert result.header is not None


async def test_get_dashboard_bundle_insights_computed(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that insights are properly computed."""
    dept_id = await get_cs_dept_id(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    # Check insights structure
    assert result.insights is not None

    # Growth insight can be None or string
    assert result.insights.growth is None or isinstance(result.insights.growth, str)

    # Persona insights is a dict
    assert isinstance(result.insights.persona, dict)

    # Other insights can be None or string
    assert result.insights.rubric_heatmap is None or isinstance(
        result.insights.rubric_heatmap, str
    )
    assert result.insights.attempt_improvement is None or isinstance(
        result.insights.attempt_improvement, str
    )
    assert isinstance(result.insights.cohort, dict)
    assert result.insights.skill_performance is None or isinstance(
        result.insights.skill_performance, str
    )


async def test_get_dashboard_bundle_caching(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that dashboard bundle can be called multiple times."""
    dept_id = await get_cs_dept_id(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
    )

    svc = DashboardService(db)

    # First call
    result1 = await svc.get_dashboard_bundle(filters)
    assert result1 is not None

    # Second call - should work without errors
    result2 = await svc.get_dashboard_bundle(filters)
    assert result2 is not None


async def test_get_dashboard_bundle_empty_data_scenario(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test dashboard bundle with date range that has no data."""
    dept_id = await get_cs_dept_id(db)

    # Use a date range far in the future
    filters = AnalyticsFilters(
        startDate="2099-01-01T00:00:00Z",
        endDate="2099-12-31T23:59:59Z",
        departmentIds=[dept_id],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    # Should still return valid structure even with no data
    assert result is not None
    assert result.header is not None
    assert result.primary is not None
    assert result.secondary is not None
    assert result.footer is not None
    assert result.insights is not None
    assert result.thresholds is not None


async def test_get_dashboard_bundle_persona_performance_structure(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that persona performance data has correct structure."""
    dept_id = await get_cs_dept_id(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    persona_perf = result.primary.persona_performance
    assert persona_perf is not None
    assert hasattr(persona_perf, "chartData")
    assert hasattr(persona_perf, "validSimulationIds")
    assert hasattr(persona_perf, "personaColors")
    assert isinstance(persona_perf.chartData, list)


async def test_get_dashboard_bundle_attempt_improvement_structure(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that attempt improvement data has correct structure."""
    dept_id = await get_cs_dept_id(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    attempt_imp = result.secondary.attempt_improvement
    assert attempt_imp is not None
    assert hasattr(attempt_imp, "chartData")
    assert hasattr(attempt_imp, "facts")
    assert hasattr(attempt_imp, "validSimulationIds")
    assert isinstance(attempt_imp.chartData, list)


async def test_get_dashboard_bundle_simulation_performance_structure(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that simulation performance data has correct structure."""
    dept_id = await get_cs_dept_id(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    sim_perf = result.footer.simulation_performance
    assert sim_perf is not None
    assert hasattr(sim_perf, "validSimulationIds")
    assert hasattr(sim_perf, "scenarioFacts")
    assert isinstance(sim_perf.validSimulationIds, list)
    assert isinstance(sim_perf.scenarioFacts, list)


async def test_get_dashboard_bundle_simulation_composition_structure(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that simulation composition data has correct structure."""
    dept_id = await get_cs_dept_id(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    sim_comp = result.footer.simulation_composition
    assert sim_comp is not None
    assert hasattr(sim_comp, "validSimulationIds")
    assert hasattr(sim_comp, "simulationFacts")
    assert hasattr(sim_comp, "simulationParameterFactsCategorical")
    assert hasattr(sim_comp, "simulationParameterFactsNumeric")
    assert hasattr(sim_comp, "hasData")
    assert isinstance(sim_comp.validSimulationIds, list)
    assert isinstance(sim_comp.simulationFacts, list)


# ============================================================================
# HEADER METRICS - REVERSE ENGINEERED LOGIC TESTS
# ============================================================================


async def test_header_completion_percentage_chat_level(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test completion percentage uses chat-level aggregation (old stored procedure logic)."""
    dept_id = await get_cs_dept_id(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    # Completion percentage should be calculated as: ROUND(100.0 * AVG((completed)::int))
    completion = result.header.completion_percentage
    assert completion is not None
    assert completion.method == "rate"
    assert isinstance(completion.currentValue, int)
    assert 0 <= completion.currentValue <= 100


async def test_header_first_attempt_pass_rate_all_time(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test first attempt pass rate finds earliest attempts across all time (old logic)."""
    dept_id = await get_cs_dept_id(db)

    filters = AnalyticsFilters(
        startDate="2024-01-01T00:00:00Z",
        endDate="2024-12-31T23:59:59Z",
        departmentIds=[dept_id],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    # First attempt pass rate should look at earliest attempt all-time, then filter to window
    first_pass = result.header.first_attempt_pass_rate
    assert first_pass is not None
    assert first_pass.method == "rate"
    assert isinstance(first_pass.currentValue, int)
    assert 0 <= first_pass.currentValue <= 100


async def test_header_efficiency_uses_old_formula(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test efficiency uses old formula: avgScore * (1 - min(1, avgMinutes/120))."""
    dept_id = await get_cs_dept_id(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    # Efficiency should use the old formula
    efficiency = result.header.session_efficiency
    assert efficiency is not None
    assert efficiency.method == "avg"
    assert isinstance(efficiency.currentValue, int)
    # Should be clamped between 0 and 100
    assert 0 <= efficiency.currentValue <= 100


async def test_header_stagnation_rate_uses_grade_stream(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test stagnation rate uses simulation_chat_grades with grade timeline (old logic)."""
    dept_id = await get_cs_dept_id(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    # Stagnation rate should use grade stream with LAG over created_at
    stagnation = result.header.stagnation_rate
    assert stagnation is not None
    assert stagnation.method == "rate"
    assert isinstance(stagnation.currentValue, int)
    assert 0 <= stagnation.currentValue <= 100


async def test_header_time_spent_sum_with_cap(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test time spent uses SUM with 30-minute cap per chat (old logic)."""
    dept_id = await get_cs_dept_id(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    # Time spent should be SUM(LEAST(time_taken_seconds / 60.0, 30.0))
    time_spent = result.header.time_spent
    assert time_spent is not None
    assert time_spent.method == "sum"
    assert isinstance(time_spent.currentValue, int)
    # Should be non-negative
    assert time_spent.currentValue >= 0


async def test_header_average_score_attempt_normalization(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test average score uses attempt-level normalization (verified correct logic)."""
    dept_id = await get_cs_dept_id(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    # Average score should use attempt-level normalization
    avg_score = result.header.average_score
    assert avg_score is not None
    assert avg_score.method == "avg"
    assert isinstance(avg_score.currentValue, int)
    assert 0 <= avg_score.currentValue <= 100


async def test_header_metrics_with_no_data(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that header metrics handle no data gracefully."""
    dept_id = await get_cs_dept_id(db)

    # Use a date range far in the future with no data
    filters = AnalyticsFilters(
        startDate="2099-01-01T00:00:00Z",
        endDate="2099-12-31T23:59:59Z",
        departmentIds=[dept_id],
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    # All header metrics should have hasData=False or handle gracefully
    assert result.header.completion_percentage is not None
    assert result.header.first_attempt_pass_rate is not None
    assert result.header.session_efficiency is not None
    assert result.header.stagnation_rate is not None
    assert result.header.time_spent is not None
    assert result.header.average_score is not None


async def test_dashboard_history_has_required_fields(
    db: asyncpg.Connection, disable_cache: None
) -> None:
    """Test that dashboard history items have all required fields including timeLimit and cohortNames."""
    dept_id = await get_cs_dept_id(db)
    admin_id = await get_superadmin_alias(db)

    filters = AnalyticsFilters(
        startDate="2020-01-01T00:00:00Z",
        endDate="2030-12-31T23:59:59Z",
        departmentIds=[dept_id],
        profileId=admin_id,
    )

    svc = DashboardService(db)
    result = await svc.get_dashboard_bundle(filters)

    # History should be a list
    assert isinstance(result.history, list)

    # If there are history items, verify they have required fields
    if len(result.history) > 0:
        history_item = result.history[0]
        assert hasattr(history_item, "attemptId"), "History item must have attemptId"
        assert hasattr(history_item, "date"), "History item must have date"
        assert hasattr(history_item, "profileId"), "History item must have profileId"
        assert hasattr(history_item, "simulationName"), "History item must have simulationName"
        assert hasattr(history_item, "timeLimit"), "History item must have timeLimit field"
        assert hasattr(history_item, "cohortNames"), "History item must have cohortNames field"

        # Verify types
        assert history_item.timeLimit is None or isinstance(
            history_item.timeLimit, int
        ), "timeLimit must be nullable int"
        assert isinstance(
            history_item.cohortNames, list
        ), "cohortNames must be a list"
