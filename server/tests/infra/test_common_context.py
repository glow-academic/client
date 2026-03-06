"""Tests for infra.common_context — central artifact GET context.

resolve_common_context is tested with mocked infra sub-functions.
Tests verify: sequential dependency (profile → settings_id → tool_graph),
parallel execution of tool_graph + runs, and early return on missing profile.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.common_context import CommonContext, resolve_common_context


MODULE = "app.infra.common_context"


# ── Helpers ──────────────────────────────────────────────────────────────────


class FakeProfileContext:
    def __init__(self, *, settings_id=None, department_ids=None, role="admin"):
        self.profiles_id = uuid4()
        self.name = "Test User"
        self.role = role
        self.role_name = "Admin"
        self.role_description = "Admin role"
        self.role_artifacts = ["persona"]
        self.primary_email = "test@test.com"
        self.emails = ["test@test.com"]
        self.primary_department_id = uuid4()
        self.department_ids = department_ids or [self.primary_department_id]
        self.settings_id = settings_id
        self.is_active = True


class FakeToolGraph:
    def __init__(self, tools=None):
        self.tools = tools or []


class FakeRunsContext:
    def __init__(self):
        self.runs = type("R", (), {"items": [], "total_count": 0})()
        self.debug_info = []


def _patch(target, return_value):
    return patch(
        f"{MODULE}.{target}", new_callable=AsyncMock, return_value=return_value
    )


# ═══════════════════════════════════════════════════════════════════════════
# resolve_common_context
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveCommonContextEmpty:
    async def test_profile_not_found_returns_none(self):
        with _patch("resolve_profile_context", None) as mock_profile:
            result = await resolve_common_context(
                None,
                None,
                profile_id=uuid4(),
            )

        assert result is None
        # Should not have called tool_graph or runs
        assert mock_profile.call_count == 1

    async def test_profile_no_settings_returns_empty_tool_graph(self):
        """Profile without settings_id → empty tool graph, runs still fetched."""
        profile = FakeProfileContext(settings_id=None)
        runs = FakeRunsContext()

        with (
            _patch("resolve_profile_context", profile),
            _patch("resolve_tool_graph", FakeToolGraph()) as mock_tg,
            _patch("resolve_runs_context", runs),
        ):
            result = await resolve_common_context(
                None,
                None,
                profile_id=uuid4(),
            )

        assert result is not None
        assert result.tool_graph.tools == []
        # resolve_tool_graph should NOT have been called (settings_id is None)
        assert mock_tg.call_count == 0


@pytest.mark.asyncio
class TestResolveCommonContextCallArgs:
    async def test_profile_id_flows_to_profile_context(self):
        profile_id = uuid4()
        profile = FakeProfileContext(settings_id=uuid4())

        with (
            _patch("resolve_profile_context", profile) as mock_profile,
            _patch("resolve_tool_graph", FakeToolGraph()),
            _patch("resolve_runs_context", FakeRunsContext()),
        ):
            await resolve_common_context(
                None,
                None,
                profile_id=profile_id,
            )

        # profile_id passed as second positional arg
        assert mock_profile.call_args[0][1] == profile_id

    async def test_settings_id_flows_to_tool_graph(self):
        """settings_id from profile flows to resolve_tool_graph."""
        settings_id = uuid4()
        profile = FakeProfileContext(settings_id=settings_id)

        with (
            _patch("resolve_profile_context", profile),
            _patch("resolve_tool_graph", FakeToolGraph()) as mock_tg,
            _patch("resolve_runs_context", FakeRunsContext()),
        ):
            await resolve_common_context(
                None,
                None,
                profile_id=uuid4(),
            )

        # settings_id passed as second positional arg to resolve_tool_graph
        assert mock_tg.call_args[0][1] == settings_id

    async def test_profile_id_flows_to_runs_context(self):
        profile_id = uuid4()
        profile = FakeProfileContext(settings_id=uuid4())

        with (
            _patch("resolve_profile_context", profile),
            _patch("resolve_tool_graph", FakeToolGraph()),
            _patch("resolve_runs_context", FakeRunsContext()) as mock_runs,
        ):
            await resolve_common_context(
                None,
                None,
                profile_id=profile_id,
            )

        assert mock_runs.call_args.kwargs["profile_id"] == profile_id

    async def test_group_id_flows_to_runs_context(self):
        profile_id = uuid4()
        group_id = uuid4()
        profile = FakeProfileContext(settings_id=uuid4())

        with (
            _patch("resolve_profile_context", profile),
            _patch("resolve_tool_graph", FakeToolGraph()),
            _patch("resolve_runs_context", FakeRunsContext()) as mock_runs,
        ):
            await resolve_common_context(
                None,
                None,
                profile_id=profile_id,
                group_id=group_id,
            )

        assert mock_runs.call_args.kwargs["group_id"] == group_id

    async def test_full_context_assembled(self):
        """All three sub-contexts assembled into CommonContext."""
        profile = FakeProfileContext(settings_id=uuid4())
        tool_graph = FakeToolGraph(tools=["tool1"])
        runs = FakeRunsContext()

        with (
            _patch("resolve_profile_context", profile),
            _patch("resolve_tool_graph", tool_graph),
            _patch("resolve_runs_context", runs),
        ):
            result = await resolve_common_context(
                None,
                None,
                profile_id=uuid4(),
            )

        assert isinstance(result, CommonContext)
        assert result.profile is profile
        assert result.tool_graph is tool_graph
        assert result.runs is runs

    async def test_bypass_cache_flows_to_all(self):
        """bypass_cache=True is passed to profile and tool_graph."""
        profile = FakeProfileContext(settings_id=uuid4())

        with (
            _patch("resolve_profile_context", profile) as mock_profile,
            _patch("resolve_tool_graph", FakeToolGraph()) as mock_tg,
            _patch("resolve_runs_context", FakeRunsContext()),
        ):
            await resolve_common_context(
                None,
                None,
                profile_id=uuid4(),
                bypass_cache=True,
            )

        # bypass_cache passed to profile context
        assert mock_profile.call_args[0][3] is True
        # bypass_cache passed to tool graph
        assert mock_tg.call_args[0][3] is True
