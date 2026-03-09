"""Tests for generate_prepare_impl — EmitFn pattern.

Orchestrates context resolution, run creation, and agent dispatch.
Uses recording_emit() to capture events.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.infra.websocket.generate_prepare_impl import generate_prepare_impl
from app.infra.websocket.socket_event import recording_emit

_P = "app.infra.websocket.generate_prepare_impl"
_PP = "app.infra.websocket.prepare_pipeline"

_PROFILE_ID = "00000000-0000-0000-0000-000000000001"
_PROFILES_ID = "00000000-0000-0000-0000-000000000002"
_SESSION_ID = "00000000-0000-0000-0000-000000000003"
_GROUP_ID = "00000000-0000-0000-0000-000000000004"


@dataclass(frozen=True)
class FakeArtifactConfig:
    artifact_type: str = "agent"
    valid_resource_types: list[str] = field(
        default_factory=lambda: ["names", "descriptions"]
    )
    entry_types: list[str] = field(default_factory=lambda: ["problems", "messages"])
    requires_draft: bool = False
    has_artifact_id: bool = True
    prepare_sql_path: str = ""
    draft_view_key: str = ""
    fetcher_id_kwarg: str = ""


def _base_data(**overrides: object) -> dict:
    d: dict = {
        "sid": "s1",
        "profile_id": _PROFILE_ID,
        "profiles_id": _PROFILES_ID,
        "session_id": _SESSION_ID,
        "group_id": _GROUP_ID,
        "artifact_types": [{"name": "agent", "operation": "get"}],
        "resource_types": [{"name": "names", "operation": "create"}],
    }
    d.update(overrides)
    return d


@pytest.mark.asyncio
class TestGeneratePrepareImpl:
    async def test_no_sid_emits_nothing(self):
        emit, events = recording_emit()
        await generate_prepare_impl(
            {"sid": ""},
            emit=emit,
            conn=AsyncMock(),
            redis=object(),
            artifact_config=FakeArtifactConfig(),
        )
        assert events == []

    async def test_no_profile_emits_error(self):
        emit, events = recording_emit()
        await generate_prepare_impl(
            _base_data(profile_id=None),
            emit=emit,
            conn=AsyncMock(),
            redis=object(),
            artifact_config=FakeArtifactConfig(),
        )
        assert len(events) == 1
        assert events[0].event == "generate_call_error"
        assert "Profile not found" in events[0].data["error_message"]

    async def test_no_profiles_id_emits_error(self):
        emit, events = recording_emit()
        await generate_prepare_impl(
            _base_data(profiles_id=None),
            emit=emit,
            conn=AsyncMock(),
            redis=object(),
            artifact_config=FakeArtifactConfig(),
        )
        assert len(events) == 1
        assert "Profiles resource" in events[0].data["error_message"]

    async def test_no_session_emits_error(self):
        emit, events = recording_emit()
        await generate_prepare_impl(
            _base_data(session_id=None),
            emit=emit,
            conn=AsyncMock(),
            redis=object(),
            artifact_config=FakeArtifactConfig(),
        )
        assert len(events) == 1
        assert "Session not found" in events[0].data["error_message"]

    async def test_no_group_id_emits_error(self):
        emit, events = recording_emit()
        await generate_prepare_impl(
            _base_data(group_id=None),
            emit=emit,
            conn=AsyncMock(),
            redis=object(),
            artifact_config=FakeArtifactConfig(),
        )
        assert len(events) == 1
        assert "group_id is required" in events[0].data["error_message"]

    async def test_no_artifact_config_emits_error(self):
        emit, events = recording_emit()
        await generate_prepare_impl(
            _base_data(),
            emit=emit,
            conn=AsyncMock(),
            redis=object(),
            artifact_config=None,
        )
        assert len(events) == 1
        assert "Unknown artifact_type" in events[0].data["error_message"]

    async def test_invalid_profile_uuid_emits_error(self):
        emit, events = recording_emit()
        await generate_prepare_impl(
            _base_data(profile_id="not-a-uuid"),
            emit=emit,
            conn=AsyncMock(),
            redis=object(),
            artifact_config=FakeArtifactConfig(),
        )
        assert len(events) == 1
        assert "Invalid request" in events[0].data["error_message"]

    async def test_context_resolution_failure_emits_error(self):
        emit, events = recording_emit()
        with patch(
            f"{_P}.resolve_websocket_context",
            new_callable=AsyncMock,
            return_value=None,
        ):
            await generate_prepare_impl(
                _base_data(),
                emit=emit,
                conn=AsyncMock(),
                redis=object(),
                artifact_config=FakeArtifactConfig(),
            )
        assert len(events) == 1
        assert "Failed to resolve context" in events[0].data["error_message"]

    async def test_no_agents_emits_error(self):
        emit, events = recording_emit()
        ws_ctx = SimpleNamespace(agents=[], models=[], providers=[], tools=[])
        with patch(
            f"{_P}.resolve_websocket_context",
            new_callable=AsyncMock,
            return_value=ws_ctx,
        ):
            await generate_prepare_impl(
                _base_data(),
                emit=emit,
                conn=AsyncMock(),
                redis=object(),
                artifact_config=FakeArtifactConfig(),
            )
        assert len(events) == 1
        assert "No system/agent" in events[0].data["error_message"]

    async def test_happy_path_emits_started_and_artifact(self):
        """Full path: context → run → dispatch → emit started + generate_artifact."""
        emit, events = recording_emit()
        agent_id = uuid4()
        model_id = uuid4()
        provider_id = uuid4()
        run_id = uuid4()

        agent = SimpleNamespace(
            id=agent_id,
            model_id=model_id,
            prompt_id=None,
            instruction_ids=[],
            tool_ids=[],
            rubric_id=None,
            department_ids=None,
        )
        model = SimpleNamespace(
            id=model_id,
            value="gpt-4o",
            name="GPT-4o",
            provider_id=provider_id,
        )
        provider = SimpleNamespace(
            id=provider_id,
            key="enc-key",
            name="openai",
            value="openai",
            endpoint="https://api.openai.com",
        )

        ws_ctx = SimpleNamespace(
            agents=[agent],
            models=[model],
            providers=[provider],
            tools=[],
            prompts=[],
            instructions=[],
            args=[],
            args_outputs=[],
            scores=SimpleNamespace(best={"names": SimpleNamespace(agent_id=agent_id)}),
            artifacts={},
        )

        mock_run = SimpleNamespace(id=run_id)
        llm_config = SimpleNamespace(
            model="gpt-4o",
            api_key="sk-test",
            base_url="https://api.openai.com",
            temperature=0.7,
            reasoning=None,
            provider="openai",
            voice=None,
            quality=None,
        )

        with (
            patch(
                f"{_P}.resolve_websocket_context",
                new_callable=AsyncMock,
                return_value=ws_ctx,
            ),
            patch(
                f"{_PP}.resolve_agent_config",
                return_value=llm_config,
            ),
            patch(
                "app.routes.v5.tools.entries.runs.create.create_run",
                new_callable=AsyncMock,
                return_value=mock_run,
            ),
            patch(
                f"{_P}.init_run_trackers",
                new_callable=AsyncMock,
            ),
            patch(
                f"{_P}.persist_run_message",
                new_callable=AsyncMock,
            ),
        ):
            await generate_prepare_impl(
                _base_data(),
                emit=emit,
                conn=AsyncMock(),
                redis=object(),
                artifact_config=FakeArtifactConfig(),
            )

        # Should emit generation_started + generate_artifact
        assert len(events) >= 2
        event_names = [e.event for e in events]
        assert "generation_started" in event_names
        assert "generate_artifact" in event_names

        started = next(e for e in events if e.event == "generation_started")
        assert started.data["artifact_type"] == "agent"
        assert started.data["run_id"] == str(run_id)

        artifact = next(e for e in events if e.event == "generate_artifact")
        assert artifact.data["artifact_type"] == "agent"
        assert artifact.data["run_id"] == str(run_id)
        assert artifact.data["llm_config"]["model"] == "gpt-4o"
