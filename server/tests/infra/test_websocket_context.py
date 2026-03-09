"""Integration tests for infra.websocket_context — real DB, no mocks."""

import pytest
from tests.helpers import nonexistent_id

from app.infra.types import ArtifactRequest, ArtifactWebsocketContext
from app.infra.websocket_context import resolve_websocket_context

pytestmark = pytest.mark.asyncio


class TestResolveWebsocketContext:
    async def test_profile_not_found_returns_none(self, pool, redis_client):
        result = await resolve_websocket_context(
            pool,
            redis_client,
            profile_id=nonexistent_id(),
            requests=[],
        )

        assert result is None

    async def test_empty_requests_returns_empty_artifacts(
        self, pool, redis_client, profile_identity_factory
    ):
        profile = await profile_identity_factory(departments=[], emails=[])

        result = await resolve_websocket_context(
            pool,
            redis_client,
            profile_id=profile.artifact_id,
            requests=[],
        )

        assert result is not None
        assert result.artifacts == {}
        assert result.systems == []
        assert result.agents == []
        assert result.tools == []

    async def test_unknown_artifact_type_raises(
        self, pool, redis_client, profile_identity_factory
    ):
        profile = await profile_identity_factory(departments=[], emails=[])

        with pytest.raises(ValueError, match="Unknown artifact type: nonexistent"):
            await resolve_websocket_context(
                pool,
                redis_client,
                profile_id=profile.artifact_id,
                requests=[
                    ArtifactRequest(
                        artifact_type="nonexistent",
                        artifact_id=nonexistent_id(),
                        group_id=nonexistent_id(),
                    )
                ],
            )

    async def test_single_persona_request_returns_namespaced_artifact_context(
        self, pool, redis_client, profile_identity_factory, persona_context_factory
    ):
        profile = await profile_identity_factory(departments=[], emails=[])
        persona = await persona_context_factory()

        result = await resolve_websocket_context(
            pool,
            redis_client,
            profile_id=profile.artifact_id,
            requests=[
                ArtifactRequest(
                    artifact_type="persona",
                    artifact_id=persona.persona_id,
                    group_id=persona.group_id,
                    draft_id=persona.draft_id,
                    params={"descriptions_search": persona.suggestion_description},
                )
            ],
        )

        assert result is not None
        assert "get.persona" in result.artifacts

        artifact = result.artifacts["get.persona"]
        assert isinstance(artifact, ArtifactWebsocketContext)
        assert artifact.params == {
            "descriptions_search": persona.suggestion_description
        }
        assert "get.names" in artifact.resources
        assert "search.names" in artifact.resources
        assert "get.descriptions" in artifact.resources
        assert "search.descriptions" in artifact.resources
        assert "get.fields" in artifact.resources
        assert "search.fields" in artifact.resources
        assert artifact.entries == {}
        assert [item.id for item in artifact.resources["get.names"]] == [
            persona.draft_name_id
        ]
        suggestion_ids = [item.id for item in artifact.resources["search.descriptions"]]
        assert persona.suggestion_description_id in suggestion_ids

    async def test_resolves_real_systems_from_profile_tool_graph(
        self, pool, redis_client, setting_graph_factory, persona_context_factory
    ):
        profile = await setting_graph_factory()
        persona = await persona_context_factory()

        result = await resolve_websocket_context(
            pool,
            redis_client,
            profile_id=profile.profile_artifact_id,
            requests=[
                ArtifactRequest(
                    artifact_type="persona",
                    artifact_id=persona.persona_id,
                    group_id=persona.group_id,
                )
            ],
        )

        assert result is not None
        assert "get.persona" in result.artifacts
        assert [system.system_id for system in result.systems] == [profile.system_id]
        assert [agent.id for agent in result.agents] == [profile.agent_id]
        assert [tool.id for tool in result.tools] == [profile.tool_id]
