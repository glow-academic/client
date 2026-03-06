"""Tests for infra.tool_graph — settings tool graph resolution + scoring.

score_tools is pure Python (no I/O).
resolve_tool_graph is tested with mocked black-box resource fetchers.
"""

from datetime import datetime, UTC
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.tool_graph import (
    ArtifactToolScores,
    ResolvedTool,
    SettingsToolGraph,
    resolve_tool_graph,
    score_tools,
)
from app.routes.v5.tools.resources.agents.types import GetAgentResponse
from app.routes.v5.tools.resources.settings.types import GetSettingResponse
from app.routes.v5.tools.resources.systems.types import GetSystemResponse
from app.routes.v5.tools.resources.tools.types import GetToolResponse


NOW = datetime.now(UTC)


# ── Helpers ──────────────────────────────────────────────────────────────────


def _tool(
    *,
    resources: list[str] | None = None,
    entries: list[str] | None = None,
    artifacts: list[str] | None = None,
    operation: str = "create",
) -> GetToolResponse:
    return GetToolResponse(
        id=uuid4(),
        name="test-tool",
        description=None,
        operation=operation,
        department_ids=[],
        args_ids=[],
        args_output_ids=[],
        resources=resources or [],
        entries=entries or [],
        artifacts=artifacts or [],
        created_at=NOW,
        active=True,
        mcp=False,
        generated=False,
    )


def _agent(*, tool_ids: list | None = None) -> GetAgentResponse:
    return GetAgentResponse(
        id=uuid4(),
        name="test-agent",
        description=None,
        department_ids=[],
        temperature=None,
        reasoning=None,
        quality=None,
        model_id=None,
        prompt_id=None,
        tool_ids=tool_ids or [],
        instruction_ids=[],
        voices=[],
        created_at=NOW,
        active=True,
        mcp=False,
        generated=False,
    )


def _system(*, agent_ids: list | None = None) -> GetSystemResponse:
    return GetSystemResponse(
        id=uuid4(),
        name="test-system",
        description=None,
        agent_ids=agent_ids or [],
        created_at=NOW,
        active=True,
        mcp=False,
        generated=False,
    )


def _setting(*, system_ids: list | None = None) -> GetSettingResponse:
    return GetSettingResponse(
        id=uuid4(),
        name="test-setting",
        description=None,
        department_ids=[],
        provider_key_ids=[],
        auth_ids=[],
        system_ids=system_ids or [],
        created_at=NOW,
        active=True,
        mcp=False,
        generated=False,
    )


def _resolved(
    *,
    system_id=None,
    agent_id=None,
    tool_id=None,
    operation="create",
    target_type="resource",
    target="names",
) -> ResolvedTool:
    return ResolvedTool(
        system_id=system_id or uuid4(),
        agent_id=agent_id or uuid4(),
        tool_id=tool_id or uuid4(),
        operation=operation,
        target_type=target_type,
        target=target,
    )


# ═══════════════════════════════════════════════════════════════════════════
# score_tools — pure unit tests
# ═══════════════════════════════════════════════════════════════════════════


class TestScoreToolsEmpty:
    def test_empty_graph_returns_none_for_all(self):
        result = score_tools(SettingsToolGraph(), {"names", "colors"})
        assert result.best["names"] is None
        assert result.best["colors"] is None
        assert result.has_any == {"names": False, "colors": False}

    def test_no_matching_targets(self):
        graph = SettingsToolGraph(tools=[_resolved(target="descriptions")])
        result = score_tools(graph, {"names", "colors"})
        assert result.best["names"] is None
        assert result.has_any["names"] is False


class TestScoreToolsSingleAgent:
    def test_single_tool_single_resource(self):
        agent_id = uuid4()
        tool = _resolved(agent_id=agent_id, target="names")
        graph = SettingsToolGraph(tools=[tool])

        result = score_tools(graph, {"names"})
        assert result.best["names"] is tool
        assert result.has_any["names"] is True

    def test_agent_covers_multiple_resources(self):
        agent_id = uuid4()
        t1 = _resolved(agent_id=agent_id, target="names")
        t2 = _resolved(agent_id=agent_id, target="colors")
        graph = SettingsToolGraph(tools=[t1, t2])

        result = score_tools(graph, {"names", "colors"})
        assert result.best["names"] is t1
        assert result.best["colors"] is t2


class TestScoreToolsMultiAgent:
    def test_specialist_wins_over_generalist(self):
        """Agent covering more artifact resources should win."""
        specialist_id = uuid4()
        generalist_id = uuid4()

        # Specialist covers names + colors (2 artifact resources)
        t_spec_names = _resolved(agent_id=specialist_id, target="names")
        t_spec_colors = _resolved(agent_id=specialist_id, target="colors")

        # Generalist covers only names (1 artifact resource)
        t_gen_names = _resolved(agent_id=generalist_id, target="names")

        graph = SettingsToolGraph(tools=[t_spec_names, t_spec_colors, t_gen_names])
        result = score_tools(graph, {"names", "colors"})

        assert result.best["names"] is t_spec_names
        assert result.best["colors"] is t_spec_colors

    def test_tiebreak_by_agent_id(self):
        """Equal coverage — deterministic pick by agent_id."""
        id_a = uuid4()
        id_b = uuid4()

        t_a = _resolved(agent_id=id_a, target="names")
        t_b = _resolved(agent_id=id_b, target="names")

        graph = SettingsToolGraph(tools=[t_a, t_b])
        result = score_tools(graph, {"names"})

        expected = t_a if id_a > id_b else t_b
        assert result.best["names"] is expected


class TestScoreToolsModality:
    def test_available_modalities_computed_from_tools(self):
        """available_modalities is the union of all agent modalities."""
        agent_id = uuid4()
        tool_id = uuid4()
        # Agent has a tool that creates images (entry)
        t1 = _resolved(
            agent_id=agent_id,
            tool_id=tool_id,
            target="images",
            target_type="entry",
            operation="create",
        )
        t2 = _resolved(
            agent_id=agent_id,
            tool_id=tool_id,
            target="names",
            target_type="resource",
            operation="create",
        )
        graph = SettingsToolGraph(tools=[t1, t2])

        result = score_tools(graph, {"images", "names"})
        # get_tool_output_modalities for (create, ["names"], ["images"], []) → {"image", "call"}
        assert "image" in result.available_modalities
        assert "call" in result.available_modalities

    def test_modality_filter_excludes_non_matching_agents(self):
        """modality='image' filters out agents that can't produce images."""
        # Agent A: only creates resources (call modality)
        agent_a = uuid4()
        tool_a = uuid4()
        t_a = _resolved(
            agent_id=agent_a,
            tool_id=tool_a,
            target="names",
            target_type="resource",
            operation="create",
        )

        # Agent B: creates images (image modality)
        agent_b = uuid4()
        tool_b = uuid4()
        t_b_names = _resolved(
            agent_id=agent_b,
            tool_id=tool_b,
            target="names",
            target_type="resource",
            operation="create",
        )
        t_b_images = _resolved(
            agent_id=agent_b,
            tool_id=tool_b,
            target="images",
            target_type="entry",
            operation="create",
        )

        graph = SettingsToolGraph(tools=[t_a, t_b_names, t_b_images])
        result = score_tools(graph, {"names", "images"}, modality="image")

        # Agent A filtered out — only agent B can produce images
        assert result.best["names"] is t_b_names
        assert result.best["images"] is t_b_images

    def test_modality_filter_no_matching_agents_returns_none(self):
        """modality='image' with no image-capable agents → all best = None."""
        agent_id = uuid4()
        tool_id = uuid4()
        t = _resolved(
            agent_id=agent_id,
            tool_id=tool_id,
            target="names",
            target_type="resource",
            operation="create",
        )
        graph = SettingsToolGraph(tools=[t])

        result = score_tools(graph, {"names"}, modality="image")
        assert result.best["names"] is None
        assert result.has_any["names"] is True  # tool exists, just filtered out

    def test_modality_none_behaves_as_before(self):
        """modality=None → no filtering, same behavior as before."""
        agent_id = uuid4()
        tool_id = uuid4()
        t = _resolved(
            agent_id=agent_id,
            tool_id=tool_id,
            target="names",
            target_type="resource",
            operation="create",
        )
        graph = SettingsToolGraph(tools=[t])

        result = score_tools(graph, {"names"}, modality=None)
        assert result.best["names"] is t

    def test_empty_graph_has_empty_modalities(self):
        result = score_tools(SettingsToolGraph(), {"names"})
        assert result.available_modalities == set()


class TestScoreToolsTargetTypes:
    def test_entry_tools(self):
        agent_id = uuid4()
        t = _resolved(agent_id=agent_id, target="contents", target_type="entry")
        graph = SettingsToolGraph(tools=[t])

        result = score_tools(graph, {"contents"})
        assert result.best["contents"] is t
        assert result.best["contents"].target_type == "entry"

    def test_mixed_target_types(self):
        agent_id = uuid4()
        t_res = _resolved(agent_id=agent_id, target="names", target_type="resource")
        t_entry = _resolved(agent_id=agent_id, target="contents", target_type="entry")
        t_art = _resolved(agent_id=agent_id, target="persona", target_type="artifact")

        graph = SettingsToolGraph(tools=[t_res, t_entry, t_art])
        result = score_tools(graph, {"names", "contents", "persona"})

        assert result.best["names"] is t_res
        assert result.best["contents"] is t_entry
        assert result.best["persona"] is t_art


# ═══════════════════════════════════════════════════════════════════════════
# resolve_tool_graph — mocked black-box tests
# ═══════════════════════════════════════════════════════════════════════════

MODULE = "app.infra.tool_graph"


@pytest.mark.asyncio
class TestResolveToolGraphEmpty:
    async def test_missing_settings_returns_empty(self):
        with patch(f"{MODULE}.get_settings", new_callable=AsyncMock, return_value=[]):
            result = await resolve_tool_graph(None, uuid4(), None)
        assert result.tools == []

    async def test_no_systems_returns_empty(self):
        setting = _setting(system_ids=[])
        with patch(
            f"{MODULE}.get_settings", new_callable=AsyncMock, return_value=[setting]
        ):
            result = await resolve_tool_graph(None, setting.id, None)
        assert result.tools == []

    async def test_no_agents_returns_empty(self):
        system = _system(agent_ids=[])
        setting = _setting(system_ids=[system.id])
        with (
            patch(
                f"{MODULE}.get_settings", new_callable=AsyncMock, return_value=[setting]
            ),
            patch(
                f"{MODULE}.get_systems", new_callable=AsyncMock, return_value=[system]
            ),
        ):
            result = await resolve_tool_graph(None, setting.id, None)
        assert result.tools == []


@pytest.mark.asyncio
class TestResolveToolGraphChain:
    async def test_full_chain_produces_resolved_tools(self):
        tool = _tool(resources=["names", "colors"])
        agent = _agent(tool_ids=[tool.id])
        system = _system(agent_ids=[agent.id])
        setting = _setting(system_ids=[system.id])

        with (
            patch(
                f"{MODULE}.get_settings", new_callable=AsyncMock, return_value=[setting]
            ),
            patch(
                f"{MODULE}.get_systems", new_callable=AsyncMock, return_value=[system]
            ),
            patch(f"{MODULE}.get_agents", new_callable=AsyncMock, return_value=[agent]),
            patch(f"{MODULE}.get_tools", new_callable=AsyncMock, return_value=[tool]),
        ):
            result = await resolve_tool_graph(None, setting.id, None)

        assert len(result.tools) == 2
        targets = {t.target for t in result.tools}
        assert targets == {"names", "colors"}
        assert all(t.agent_id == agent.id for t in result.tools)
        assert all(t.system_id == system.id for t in result.tools)
        assert all(t.target_type == "resource" for t in result.tools)

    async def test_tool_with_entries_and_artifacts(self):
        tool = _tool(resources=["names"], entries=["contents"], artifacts=["persona"])
        agent = _agent(tool_ids=[tool.id])
        system = _system(agent_ids=[agent.id])
        setting = _setting(system_ids=[system.id])

        with (
            patch(
                f"{MODULE}.get_settings", new_callable=AsyncMock, return_value=[setting]
            ),
            patch(
                f"{MODULE}.get_systems", new_callable=AsyncMock, return_value=[system]
            ),
            patch(f"{MODULE}.get_agents", new_callable=AsyncMock, return_value=[agent]),
            patch(f"{MODULE}.get_tools", new_callable=AsyncMock, return_value=[tool]),
        ):
            result = await resolve_tool_graph(None, setting.id, None)

        types = {t.target_type for t in result.tools}
        assert types == {"resource", "entry", "artifact"}
        assert len(result.tools) == 3

    async def test_multiple_systems_and_agents(self):
        tool_a = _tool(resources=["names"])
        tool_b = _tool(resources=["colors"])
        agent_a = _agent(tool_ids=[tool_a.id])
        agent_b = _agent(tool_ids=[tool_b.id])
        system_a = _system(agent_ids=[agent_a.id])
        system_b = _system(agent_ids=[agent_b.id])
        setting = _setting(system_ids=[system_a.id, system_b.id])

        with (
            patch(
                f"{MODULE}.get_settings", new_callable=AsyncMock, return_value=[setting]
            ),
            patch(
                f"{MODULE}.get_systems",
                new_callable=AsyncMock,
                return_value=[system_a, system_b],
            ),
            patch(
                f"{MODULE}.get_agents",
                new_callable=AsyncMock,
                return_value=[agent_a, agent_b],
            ),
            patch(
                f"{MODULE}.get_tools",
                new_callable=AsyncMock,
                return_value=[tool_a, tool_b],
            ),
        ):
            result = await resolve_tool_graph(None, setting.id, None)

        assert len(result.tools) == 2
        assert {t.target for t in result.tools} == {"names", "colors"}
        # Each tool should trace back to its own system
        names_tool = next(t for t in result.tools if t.target == "names")
        colors_tool = next(t for t in result.tools if t.target == "colors")
        assert names_tool.system_id == system_a.id
        assert colors_tool.system_id == system_b.id

    async def test_shared_agent_across_systems(self):
        """Same agent referenced by two systems — tools appear under each system."""
        tool = _tool(resources=["names"])
        agent = _agent(tool_ids=[tool.id])
        system_a = _system(agent_ids=[agent.id])
        system_b = _system(agent_ids=[agent.id])
        setting = _setting(system_ids=[system_a.id, system_b.id])

        with (
            patch(
                f"{MODULE}.get_settings", new_callable=AsyncMock, return_value=[setting]
            ),
            patch(
                f"{MODULE}.get_systems",
                new_callable=AsyncMock,
                return_value=[system_a, system_b],
            ),
            patch(f"{MODULE}.get_agents", new_callable=AsyncMock, return_value=[agent]),
            patch(f"{MODULE}.get_tools", new_callable=AsyncMock, return_value=[tool]),
        ):
            result = await resolve_tool_graph(None, setting.id, None)

        # Same tool appears twice — once per system
        assert len(result.tools) == 2
        system_ids = {t.system_id for t in result.tools}
        assert system_ids == {system_a.id, system_b.id}
