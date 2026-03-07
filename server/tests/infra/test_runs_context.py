"""Tests for infra.runs_context — daily runs + debug info resolution.

resolve_runs_context is tested with mocked black-box fetchers.
Tests verify: correct arguments flow to fetchers, date defaults, filtering.
"""

from datetime import UTC, datetime
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.runs_context import RunsContext, resolve_runs_context

MODULE = "app.infra.runs_context"


# ── Helpers ──────────────────────────────────────────────────────────────────


class FakeRunListView:
    def __init__(self, items=None, total_count=0):
        self.items = items or []
        self.total_count = total_count


class FakeDebugInfo:
    def __init__(self, *, run_id=None):
        self.id = uuid4()
        self.run_id = run_id or uuid4()


def _patch(target, return_value):
    return patch(
        f"{MODULE}.{target}", new_callable=AsyncMock, return_value=return_value
    )


# ═══════════════════════════════════════════════════════════════════════════
# resolve_runs_context
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveRunsContextEmpty:
    async def test_no_runs_returns_empty(self):
        profile_id = uuid4()
        empty_runs = FakeRunListView()

        with (
            _patch("get_run_list_entries_internal", empty_runs),
            _patch("search_debug_info", []),
        ):
            result = await resolve_runs_context(None, profile_id=profile_id)

        assert isinstance(result, RunsContext)
        assert result.runs.items == []
        assert result.runs.total_count == 0
        assert result.debug_info == []


@pytest.mark.asyncio
class TestResolveRunsContextCallArgs:
    """Verify correct arguments flow to each fetcher."""

    async def test_profile_id_passed_as_filter(self):
        """profile_id flows to get_run_list_entries_internal as profile_id_filter."""
        profile_id = uuid4()
        runs = FakeRunListView()

        with (
            _patch("get_run_list_entries_internal", runs) as mock_runs,
            _patch("search_debug_info", []),
        ):
            await resolve_runs_context(None, profile_id=profile_id)

        assert mock_runs.call_args.kwargs["profile_id_filter"] == profile_id

    async def test_group_id_passed_as_filter(self):
        """group_id flows to get_run_list_entries_internal as group_id_filter."""
        profile_id = uuid4()
        group_id = uuid4()
        runs = FakeRunListView()

        with (
            _patch("get_run_list_entries_internal", runs) as mock_runs,
            _patch("search_debug_info", []),
        ):
            await resolve_runs_context(None, profile_id=profile_id, group_id=group_id)

        assert mock_runs.call_args.kwargs["group_id_filter"] == group_id

    async def test_custom_dates_passed_to_both_fetchers(self):
        """Custom date_from/date_to flow to both runs and debug_info fetchers."""
        profile_id = uuid4()
        date_from = datetime(2025, 1, 1, tzinfo=UTC)
        date_to = datetime(2025, 1, 2, tzinfo=UTC)
        runs = FakeRunListView()

        with (
            _patch("get_run_list_entries_internal", runs) as mock_runs,
            _patch("search_debug_info", []) as mock_debug,
        ):
            await resolve_runs_context(
                None,
                profile_id=profile_id,
                date_from=date_from,
                date_to=date_to,
            )

        # Both fetchers receive the same date range
        assert mock_runs.call_args.kwargs["date_from"] == date_from
        assert mock_runs.call_args.kwargs["date_to"] == date_to
        assert mock_debug.call_args.kwargs["date_from"] == date_from
        assert mock_debug.call_args.kwargs["date_to"] == date_to

    async def test_defaults_to_today_start(self):
        """When no date range provided, date_from defaults to start of today."""
        profile_id = uuid4()
        runs = FakeRunListView()

        with (
            _patch("get_run_list_entries_internal", runs) as mock_runs,
            _patch("search_debug_info", []) as mock_debug,
        ):
            await resolve_runs_context(None, profile_id=profile_id)

        date_from = mock_runs.call_args.kwargs["date_from"]
        assert date_from.hour == 0
        assert date_from.minute == 0
        assert date_from.second == 0
        assert date_from.microsecond == 0

        # Same date_from used for debug_info
        assert mock_debug.call_args.kwargs["date_from"] == date_from

    async def test_runs_and_debug_info_assembled(self):
        """Return values from both fetchers assembled into RunsContext."""
        profile_id = uuid4()
        run_item = object()
        debug = FakeDebugInfo()
        runs = FakeRunListView(items=[run_item], total_count=1)

        with (
            _patch("get_run_list_entries_internal", runs),
            _patch("search_debug_info", [debug]),
        ):
            result = await resolve_runs_context(None, profile_id=profile_id)

        assert result.runs.items == [run_item]
        assert result.runs.total_count == 1
        assert result.debug_info == [debug]

    async def test_multiple_debug_entries(self):
        profile_id = uuid4()
        debug1 = FakeDebugInfo()
        debug2 = FakeDebugInfo()
        debug3 = FakeDebugInfo()
        runs = FakeRunListView()

        with (
            _patch("get_run_list_entries_internal", runs),
            _patch("search_debug_info", [debug1, debug2, debug3]),
        ):
            result = await resolve_runs_context(None, profile_id=profile_id)

        assert len(result.debug_info) == 3
