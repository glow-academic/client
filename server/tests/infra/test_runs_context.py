"""Tests for infra.runs_context — daily runs resolution.

resolve_runs_context is tested with mocked black-box fetchers.
Tests verify: correct arguments flow to fetchers, date defaults, filtering.
"""

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

        with _patch("get_run_list_entries_internal", empty_runs):
            result = await resolve_runs_context(None, profile_id=profile_id)

        assert isinstance(result, RunsContext)
        assert result.runs.items == []
        assert result.runs.total_count == 0
