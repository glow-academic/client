"""Tests for infra.auth.analytics — analytics filters via canonical black boxes.

Each resolve_*_filters function is tested with mocked black-box fetchers.
Tests verify: correct arguments flow, result mapping, empty/missing cases.
"""

from datetime import UTC, date, datetime
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.infra.auth.analytics import (
    AnalyticsFiltersResult,
    FilterOption,
    resolve_benchmark_filters,
    resolve_health_filters,
    resolve_pricing_filters,
    resolve_profile_facts_filters,
)

NOW = datetime.now(UTC)
TODAY = date.today()
MODULE = "app.infra.auth.analytics"


# ── Helpers ──────────────────────────────────────────────────────────────────


def _mock_pool():
    """Create a mock pool that yields mock connections via acquire()."""
    pool = MagicMock()
    conns = []

    class _CM:
        async def __aenter__(self):
            c = AsyncMock()
            conns.append(c)
            return c

        async def __aexit__(self, *args):
            pass

    pool.acquire = _CM
    pool._conns = conns
    return pool


def _patch(target, return_value):
    return patch(
        f"{MODULE}.{target}", new_callable=AsyncMock, return_value=return_value
    )


def _department(*, id=None, name="Dept"):
    d = MagicMock()
    d.id = id or uuid4()
    d.name = name
    return d


def _cohort(*, id=None, name="Cohort"):
    c = MagicMock()
    c.id = id or uuid4()
    c.name = name
    return c


def _attempt_chat(*, attempt_date=None):
    item = MagicMock()
    item.attempt_date = attempt_date or TODAY
    return item


def _run(*, run_created_at=None):
    item = MagicMock()
    item.run_created_at = run_created_at or NOW
    return item


def _test(*, test_created_at=None):
    item = MagicMock()
    item.test_created_at = test_created_at or NOW
    return item


def _health(*, date_hour=None):
    item = MagicMock()
    item.date_hour = date_hour or NOW
    return item


# ═══════════════════════════════════════════════════════════════════════════
# resolve_profile_facts_filters
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestProfileFactsFilters:
    async def test_returns_departments_and_cohorts(self):
        dept_id = uuid4()
        cohort_id = uuid4()
        dept = _department(id=dept_id, name="Science")
        cohort = _cohort(id=cohort_id, name="Fall 2025")

        pool = _mock_pool()
        redis = AsyncMock()

        with (
            _patch("get_departments", [dept]),
            _patch("get_cohorts", [cohort]),
            _patch("search_attempt_chats", ([_attempt_chat()], 1)),
        ):
            result = await resolve_profile_facts_filters(
                pool,
                redis,
                department_ids=[dept_id],
                cohort_ids=[cohort_id],
            )

        assert len(result.department_options) == 1
        assert result.department_options[0].value == str(dept_id)
        assert result.department_options[0].label == "Science"
        assert len(result.cohort_options) == 1
        assert result.cohort_options[0].label == "Fall 2025"

    async def test_date_range_from_attempt_chats(self):
        dept_id = uuid4()
        early = date(2025, 1, 1)
        late = date(2025, 12, 31)
        pool = _mock_pool()
        redis = AsyncMock()

        with (
            _patch("get_departments", []),
            _patch("get_cohorts", []),
            _patch("search_attempt_chats", None) as mock_search,
        ):
            mock_search.side_effect = [
                ([_attempt_chat(attempt_date=early)], 1),
                ([_attempt_chat(attempt_date=late)], 1),
            ]
            result = await resolve_profile_facts_filters(
                pool,
                redis,
                department_ids=[dept_id],
                cohort_ids=[],
                need_departments=False,
                need_cohorts=False,
            )

        assert result.date_range_earliest == "2025-01-01"
        assert result.date_range_latest == "2025-12-31"

    async def test_no_department_ids_skips_date_range(self):
        pool = _mock_pool()
        redis = AsyncMock()

        with (
            _patch("get_departments", []),
            _patch("get_cohorts", []),
            _patch("search_attempt_chats", ([], 0)),
        ):
            result = await resolve_profile_facts_filters(
                pool,
                redis,
                department_ids=[],
                cohort_ids=[],
            )

        assert result.date_range_earliest is None
        assert result.date_range_latest is None

    async def test_need_flags_control_fetching(self):
        pool = _mock_pool()
        redis = AsyncMock()

        with (
            _patch("get_departments", []) as mock_dept,
            _patch("get_cohorts", []) as mock_cohort,
            _patch("search_attempt_chats", ([], 0)) as mock_search,
        ):
            result = await resolve_profile_facts_filters(
                pool,
                redis,
                department_ids=[uuid4()],
                cohort_ids=[uuid4()],
                need_departments=False,
                need_cohorts=False,
                need_date_range=False,
            )

        assert result.department_options == []
        assert result.cohort_options == []
        assert result.date_range_earliest is None
        mock_dept.assert_not_called()
        mock_cohort.assert_not_called()
        mock_search.assert_not_called()


# ═══════════════════════════════════════════════════════════════════════════
# resolve_pricing_filters
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestPricingFilters:
    async def test_returns_departments_and_date_range(self):
        dept_id = uuid4()
        dept = _department(id=dept_id, name="Engineering")
        early_run = _run(run_created_at=datetime(2025, 3, 1, tzinfo=UTC))
        late_run = _run(run_created_at=datetime(2025, 9, 15, tzinfo=UTC))

        pool = _mock_pool()
        redis = AsyncMock()

        with (
            _patch("get_departments", [dept]),
            _patch("search_runs", None) as mock_runs,
        ):
            mock_runs.side_effect = [
                ([early_run], 1),
                ([late_run], 1),
            ]
            result = await resolve_pricing_filters(
                pool,
                redis,
                department_ids=[dept_id],
            )

        assert len(result.department_options) == 1
        assert result.department_options[0].label == "Engineering"
        assert result.date_range_earliest == "2025-03-01"
        assert result.date_range_latest == "2025-09-15"

    async def test_no_runs_returns_no_date_range(self):
        pool = _mock_pool()
        redis = AsyncMock()

        with (
            _patch("get_departments", []),
            _patch("search_runs", None) as mock_runs,
        ):
            mock_runs.side_effect = [
                ([], 0),
                ([], 0),
            ]
            result = await resolve_pricing_filters(
                pool,
                redis,
                department_ids=[],
            )

        assert result.date_range_earliest is None
        assert result.date_range_latest is None


# ═══════════════════════════════════════════════════════════════════════════
# resolve_benchmark_filters
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestBenchmarkFilters:
    async def test_returns_departments_and_date_range(self):
        dept_id = uuid4()
        dept = _department(id=dept_id, name="Math")
        early_test = _test(test_created_at=datetime(2025, 2, 1, tzinfo=UTC))
        late_test = _test(test_created_at=datetime(2025, 11, 1, tzinfo=UTC))

        pool = _mock_pool()
        redis = AsyncMock()

        with (
            _patch("get_departments", [dept]),
            _patch("search_tests", None) as mock_tests,
        ):
            mock_tests.side_effect = [early_test, late_test]
            # search_tests returns list, called twice (asc + desc)
            mock_tests.side_effect = [[early_test], [late_test]]
            result = await resolve_benchmark_filters(
                pool,
                redis,
                department_ids=[dept_id],
            )

        assert len(result.department_options) == 1
        assert result.department_options[0].label == "Math"
        assert result.date_range_earliest is not None
        assert result.date_range_latest is not None

    async def test_no_tests_returns_no_date_range(self):
        pool = _mock_pool()
        redis = AsyncMock()

        with (
            _patch("get_departments", []),
            _patch("search_tests", None) as mock_tests,
        ):
            mock_tests.side_effect = [[], []]
            result = await resolve_benchmark_filters(
                pool,
                redis,
                department_ids=[],
            )

        assert result.date_range_earliest is None
        assert result.date_range_latest is None


# ═══════════════════════════════════════════════════════════════════════════
# resolve_health_filters
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestHealthFilters:
    async def test_returns_date_range(self):
        early = _health(date_hour=datetime(2025, 1, 1, tzinfo=UTC))
        late = _health(date_hour=datetime(2025, 12, 31, tzinfo=UTC))

        pool = _mock_pool()

        with _patch("search_health", None) as mock_health:
            mock_health.side_effect = [[early], [late]]
            result = await resolve_health_filters(pool)

        assert result.date_range_earliest is not None
        assert result.date_range_latest is not None
        assert result.department_options == []
        assert result.cohort_options == []

    async def test_no_health_data_returns_none(self):
        pool = _mock_pool()

        with _patch("search_health", None) as mock_health:
            mock_health.side_effect = [[], []]
            result = await resolve_health_filters(pool)

        assert result.date_range_earliest is None
        assert result.date_range_latest is None

    async def test_need_date_range_false_skips(self):
        pool = _mock_pool()

        with _patch("search_health", []) as mock_health:
            result = await resolve_health_filters(pool, need_date_range=False)

        assert result == AnalyticsFiltersResult()
        mock_health.assert_not_called()
