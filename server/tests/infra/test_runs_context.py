"""Tests for infra.runs_context — daily runs resolution."""

from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.infra.runs_context import RunsContext, resolve_runs_context

MODULE = "app.infra.runs_context"


# ── Helpers ──────────────────────────────────────────────────────────────────


def _patch(target, return_value):
    return patch(
        f"{MODULE}.{target}", new_callable=AsyncMock, return_value=return_value
    )


def _mock_pool(mock_conn: AsyncMock | None = None) -> MagicMock:
    """Create a mock pool whose acquire() yields mock_conn."""
    if mock_conn is None:
        mock_conn = AsyncMock()
    pool = MagicMock()
    cm = AsyncMock()
    cm.__aenter__.return_value = mock_conn
    pool.acquire.return_value = cm
    return pool


# ═══════════════════════════════════════════════════════════════════════════
# resolve_runs_context
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveRunsContextEmpty:
    async def test_no_runs_returns_empty(self):
        profile_id = uuid4()
        pool = _mock_pool()

        with _patch("search_runs", ([], 0)):
            result = await resolve_runs_context(pool, profile_id=profile_id)

        assert isinstance(result, RunsContext)
        assert result.items == []
        assert result.total_count == 0
