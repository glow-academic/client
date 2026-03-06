"""Tests for infra.websocket_context — multi-artifact websocket composition.

resolve_websocket_context is tested with mocked infra sub-functions.
Tests verify: parallel artifact resolution, cross-artifact scoring,
system resolution, deduplication, and namespaced output shape.
"""

from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.types import (
    ArtifactContext,
    ArtifactRequest,
    ArtifactWebsocketContext,
    ResourcePair,
    WebsocketContext,
)
from app.infra.websocket_context import (
    ARTIFACT_RESOLVERS,
    ArtifactResolverConfig,
    PERSONA_SCORING_RESOURCES,
    resolve_websocket_context,
)
from app.infra.tool_graph import ArtifactToolScores, ResolvedTool, SettingsToolGraph


MODULE = "app.infra.websocket_context"


# ── Helpers ──────────────────────────────────────────────────────────────────


class FakeProfile:
    def __init__(self):
        self.department_ids = [uuid4()]
        self.role = "admin"
        self.name = "Test User"
        self.settings_id = uuid4()


class FakeCommonContext:
    def __init__(self, profile=None, tool_graph=None):
        self.profile = profile or FakeProfile()
        self.tool_graph = tool_graph or SettingsToolGraph(tools=[])
        self.runs = None


class FakeSystemContext:
    def __init__(self, system_id=None):
        self.system_id = system_id or uuid4()
        self.agents = [type("A", (), {"id": uuid4()})()]
        self.models = [type("M", (), {"id": uuid4()})()]
        self.providers = [type("P", (), {"id": uuid4()})()]
        self.tools = [type("T", (), {"id": uuid4()})()]
        self.args = [type("Arg", (), {"id": uuid4()})()]
        self.args_outputs = [type("AO", (), {"id": uuid4()})()]
        self.prompts = [type("Pr", (), {"id": uuid4()})()]
        self.instructions = [type("I", (), {"id": uuid4()})()]


def _persona_artifact_context(*, artifact_id=None, group_id=None):
    """Build a minimal ArtifactContext for persona."""
    return ArtifactContext(
        artifact_id=artifact_id or uuid4(),
        active=True,
        group_id=group_id or uuid4(),
        draft_version=None,
        resources={
            "names": ResourcePair(selected=[], suggestions=[]),
            "descriptions": ResourcePair(selected=[], suggestions=[]),
            "colors": ResourcePair(selected=[], suggestions=[]),
            "icons": ResourcePair(selected=[], suggestions=[]),
            "instructions": ResourcePair(selected=[], suggestions=[]),
            "flags": ResourcePair(selected=[], suggestions=[]),
            "departments": ResourcePair(selected=[], suggestions=[]),
            "parameter_fields": ResourcePair(selected=[], suggestions=[]),
            "examples": ResourcePair(selected=[], suggestions=[]),
            "voices": ResourcePair(selected=[], suggestions=[]),
            "parameters": ResourcePair(selected=[], suggestions=[]),
            "fields": ResourcePair(selected=[], suggestions=[]),
        },
        entries={
            "personas_resource_ids": [],
            "has_active_scenarios": False,
        },
    )


def _empty_scores():
    return ArtifactToolScores(best={}, has_any={})


def _scores_with_system(system_id, resources):
    """Build scores where all resources map to the same system."""
    best = {}
    for r in resources:
        best[r] = ResolvedTool(
            system_id=system_id,
            agent_id=uuid4(),
            tool_id=uuid4(),
            operation="create",
            target_type="resource",
            target=r,
        )
    return ArtifactToolScores(
        best=best,
        has_any={r: True for r in resources},
    )


def _mock_persona_resolver(mock_resolver):
    """Temporarily replace the persona resolver in ARTIFACT_RESOLVERS with a mock."""
    original = ARTIFACT_RESOLVERS["persona"]
    ARTIFACT_RESOLVERS["persona"] = ArtifactResolverConfig(
        resolver=mock_resolver,
        scoring_resources=original.scoring_resources,
        id_kwarg=original.id_kwarg,
    )
    return original


# ═══════════════════════════════════════════════════════════════════════════
# resolve_websocket_context
# ═══════════════════════════════════════════════════════════════════════════


@pytest.mark.asyncio
class TestResolveWebsocketContextEmpty:
    async def test_returns_none_when_profile_not_found(self):
        """No profile → returns None."""
        with patch(f"{MODULE}.resolve_common_context", new_callable=AsyncMock, return_value=None):
            result = await resolve_websocket_context(
                None, None,
                profile_id=uuid4(),
                requests=[],
            )

        assert result is None

    async def test_empty_requests_returns_empty_artifacts(self):
        """No artifact requests → empty artifacts dict."""
        common = FakeCommonContext()

        with (
            patch(f"{MODULE}.resolve_common_context", new_callable=AsyncMock, return_value=common),
            patch(f"{MODULE}.score_tools", return_value=_empty_scores()),
        ):
            result = await resolve_websocket_context(
                None, None,
                profile_id=uuid4(),
                requests=[],
            )

        assert result is not None
        assert result.artifacts == {}
        assert result.systems == []
        assert result.agents == []

    async def test_unknown_artifact_type_raises(self):
        """Unregistered artifact type raises ValueError."""
        common = FakeCommonContext()

        with (
            patch(f"{MODULE}.resolve_common_context", new_callable=AsyncMock, return_value=common),
            pytest.raises(ValueError, match="Unknown artifact type: nonexistent"),
        ):
            await resolve_websocket_context(
                None, None,
                profile_id=uuid4(),
                requests=[ArtifactRequest(
                    artifact_type="nonexistent",
                    artifact_id=uuid4(),
                    group_id=uuid4(),
                )],
            )


@pytest.mark.asyncio
class TestResolveWebsocketContextSingleArtifact:
    async def test_persona_artifact_shape(self):
        """Single persona request → verify namespaced output shape."""
        persona_id = uuid4()
        group_id = uuid4()
        common = FakeCommonContext()
        persona_ctx = _persona_artifact_context(artifact_id=persona_id, group_id=group_id)

        mock_resolver = AsyncMock(return_value=persona_ctx)
        original = _mock_persona_resolver(mock_resolver)
        try:
            with (
                patch(f"{MODULE}.resolve_common_context", new_callable=AsyncMock, return_value=common),
                patch(f"{MODULE}.score_tools", return_value=_empty_scores()),
            ):
                result = await resolve_websocket_context(
                    None, None,
                    profile_id=uuid4(),
                    requests=[ArtifactRequest(
                        artifact_type="persona",
                        artifact_id=persona_id,
                        group_id=group_id,
                    )],
                )
        finally:
            ARTIFACT_RESOLVERS["persona"] = original

        assert result is not None
        assert "get.persona" in result.artifacts

        art = result.artifacts["get.persona"]
        assert isinstance(art, ArtifactWebsocketContext)

        # Resources namespaced with get./search.
        assert "get.names" in art.resources
        assert "search.names" in art.resources
        assert "get.colors" in art.resources
        assert "search.colors" in art.resources

        # Fields in resources (not entries)
        assert "get.fields" in art.resources
        assert "search.fields" in art.resources

        # Entries namespaced with get.
        assert "get.has_active_scenarios" in art.entries

    async def test_params_flow_to_resolver(self):
        """Params from ArtifactRequest are passed to resolver."""
        common = FakeCommonContext()
        persona_ctx = _persona_artifact_context()

        mock_resolver = AsyncMock(return_value=persona_ctx)
        original = _mock_persona_resolver(mock_resolver)
        try:
            with (
                patch(f"{MODULE}.resolve_common_context", new_callable=AsyncMock, return_value=common),
                patch(f"{MODULE}.score_tools", return_value=_empty_scores()),
            ):
                await resolve_websocket_context(
                    None, None,
                    profile_id=uuid4(),
                    requests=[ArtifactRequest(
                        artifact_type="persona",
                        artifact_id=uuid4(),
                        group_id=uuid4(),
                        params={"color_search": "blue", "icon_search": "star"},
                    )],
                )
        finally:
            ARTIFACT_RESOLVERS["persona"] = original

        call_kwargs = mock_resolver.call_args.kwargs
        assert call_kwargs["color_search"] == "blue"
        assert call_kwargs["icon_search"] == "star"

    async def test_resolver_receives_artifact_id(self):
        """artifact_id flows as persona_id to the persona resolver."""
        persona_id = uuid4()
        common = FakeCommonContext()
        persona_ctx = _persona_artifact_context()

        mock_resolver = AsyncMock(return_value=persona_ctx)
        original = _mock_persona_resolver(mock_resolver)
        try:
            with (
                patch(f"{MODULE}.resolve_common_context", new_callable=AsyncMock, return_value=common),
                patch(f"{MODULE}.score_tools", return_value=_empty_scores()),
            ):
                await resolve_websocket_context(
                    None, None,
                    profile_id=uuid4(),
                    requests=[ArtifactRequest(
                        artifact_type="persona",
                        artifact_id=persona_id,
                        group_id=uuid4(),
                    )],
                )
        finally:
            ARTIFACT_RESOLVERS["persona"] = original

        assert mock_resolver.call_args.kwargs["persona_id"] == persona_id

    async def test_user_department_ids_flow_to_resolver(self):
        """Profile department_ids flow to resolver."""
        dept_id = uuid4()
        profile = FakeProfile()
        profile.department_ids = [dept_id]
        common = FakeCommonContext(profile=profile)
        persona_ctx = _persona_artifact_context()

        mock_resolver = AsyncMock(return_value=persona_ctx)
        original = _mock_persona_resolver(mock_resolver)
        try:
            with (
                patch(f"{MODULE}.resolve_common_context", new_callable=AsyncMock, return_value=common),
                patch(f"{MODULE}.score_tools", return_value=_empty_scores()),
            ):
                await resolve_websocket_context(
                    None, None,
                    profile_id=uuid4(),
                    requests=[ArtifactRequest(
                        artifact_type="persona",
                        artifact_id=uuid4(),
                        group_id=uuid4(),
                    )],
                )
        finally:
            ARTIFACT_RESOLVERS["persona"] = original

        assert mock_resolver.call_args.kwargs["user_department_ids"] == [dept_id]


@pytest.mark.asyncio
class TestResolveWebsocketContextScoring:
    async def test_scoring_uses_artifact_resources(self):
        """score_tools called with the artifact's scoring resources."""
        common = FakeCommonContext()
        persona_ctx = _persona_artifact_context()

        mock_resolver = AsyncMock(return_value=persona_ctx)
        original = _mock_persona_resolver(mock_resolver)
        try:
            with (
                patch(f"{MODULE}.resolve_common_context", new_callable=AsyncMock, return_value=common),
                patch(f"{MODULE}.score_tools", return_value=_empty_scores()) as mock_score,
            ):
                await resolve_websocket_context(
                    None, None,
                    profile_id=uuid4(),
                    requests=[ArtifactRequest(
                        artifact_type="persona",
                        artifact_id=uuid4(),
                        group_id=uuid4(),
                    )],
                )
        finally:
            ARTIFACT_RESOLVERS["persona"] = original

        call_args = mock_score.call_args
        assert call_args[0][1] == PERSONA_SCORING_RESOURCES

    async def test_system_resolution_for_winners(self):
        """Only winning system_ids are resolved."""
        system_id = uuid4()
        common = FakeCommonContext()
        persona_ctx = _persona_artifact_context()
        scores = _scores_with_system(system_id, {"names"})
        fake_sc = FakeSystemContext(system_id=system_id)

        mock_resolver = AsyncMock(return_value=persona_ctx)
        original = _mock_persona_resolver(mock_resolver)
        try:
            with (
                patch(f"{MODULE}.resolve_common_context", new_callable=AsyncMock, return_value=common),
                patch(f"{MODULE}.score_tools", return_value=scores),
                patch(f"{MODULE}.resolve_system_context", new_callable=AsyncMock, return_value=fake_sc) as mock_sys,
            ):
                result = await resolve_websocket_context(
                    None, None,
                    profile_id=uuid4(),
                    requests=[ArtifactRequest(
                        artifact_type="persona",
                        artifact_id=uuid4(),
                        group_id=uuid4(),
                    )],
                )
        finally:
            ARTIFACT_RESOLVERS["persona"] = original

        assert mock_sys.call_count == 1
        assert mock_sys.call_args.kwargs["system_id"] == system_id

        assert len(result.systems) == 1
        assert result.systems[0].system_id == system_id
        assert len(result.agents) == 1
        assert len(result.models) == 1

    async def test_no_systems_when_no_tools(self):
        """No tools in graph → no system resolution."""
        common = FakeCommonContext()
        persona_ctx = _persona_artifact_context()

        mock_resolver = AsyncMock(return_value=persona_ctx)
        original = _mock_persona_resolver(mock_resolver)
        try:
            with (
                patch(f"{MODULE}.resolve_common_context", new_callable=AsyncMock, return_value=common),
                patch(f"{MODULE}.score_tools", return_value=_empty_scores()),
                patch(f"{MODULE}.resolve_system_context", new_callable=AsyncMock) as mock_sys,
            ):
                result = await resolve_websocket_context(
                    None, None,
                    profile_id=uuid4(),
                    requests=[ArtifactRequest(
                        artifact_type="persona",
                        artifact_id=uuid4(),
                        group_id=uuid4(),
                    )],
                )
        finally:
            ARTIFACT_RESOLVERS["persona"] = original

        assert mock_sys.call_count == 0
        assert result.systems == []
        assert result.agents == []

    async def test_dedup_across_systems(self):
        """Two systems sharing an agent → agent appears once."""
        system_id_1 = uuid4()
        system_id_2 = uuid4()
        shared_agent_id = uuid4()

        shared_agent = type("A", (), {"id": shared_agent_id})()

        sc1 = FakeSystemContext(system_id=system_id_1)
        sc1.agents = [shared_agent]
        sc1.models = []
        sc1.providers = []
        sc1.tools = []
        sc1.args = []
        sc1.args_outputs = []
        sc1.prompts = []
        sc1.instructions = []

        sc2 = FakeSystemContext(system_id=system_id_2)
        sc2.agents = [shared_agent]
        sc2.models = []
        sc2.providers = []
        sc2.tools = []
        sc2.args = []
        sc2.args_outputs = []
        sc2.prompts = []
        sc2.instructions = []

        best = {
            "names": ResolvedTool(
                system_id=system_id_1, agent_id=uuid4(), tool_id=uuid4(),
                operation="create", target_type="resource", target="names",
            ),
            "descriptions": ResolvedTool(
                system_id=system_id_2, agent_id=uuid4(), tool_id=uuid4(),
                operation="create", target_type="resource", target="descriptions",
            ),
        }
        scores = ArtifactToolScores(best=best, has_any={"names": True, "descriptions": True})

        common = FakeCommonContext()
        persona_ctx = _persona_artifact_context()

        mock_resolver = AsyncMock(return_value=persona_ctx)
        original = _mock_persona_resolver(mock_resolver)
        try:
            with (
                patch(f"{MODULE}.resolve_common_context", new_callable=AsyncMock, return_value=common),
                patch(f"{MODULE}.score_tools", return_value=scores),
                patch(f"{MODULE}.resolve_system_context", new_callable=AsyncMock, side_effect=[sc1, sc2]),
            ):
                result = await resolve_websocket_context(
                    None, None,
                    profile_id=uuid4(),
                    requests=[ArtifactRequest(
                        artifact_type="persona",
                        artifact_id=uuid4(),
                        group_id=uuid4(),
                    )],
                )
        finally:
            ARTIFACT_RESOLVERS["persona"] = original

        assert len(result.systems) == 2
        assert len(result.agents) == 1
        assert result.agents[0].id == shared_agent_id
